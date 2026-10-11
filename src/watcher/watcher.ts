/**
 * Watcher – streams payment operations from Horizon for all configured accounts.
 *
 * Handles:
 * - payment, path_payment_strict_send, path_payment_strict_receive, create_account
 * - Cursor resume across restarts (via CursorStore)
 * - Exponential backoff reconnect on stream error/close (1s → 60s)
 * - Notifier error isolation: a failing notifier never blocks others
 */

import { Horizon } from "@stellar/stellar-sdk";
import { pino, type Logger } from "pino";
import type { LumenWatchConfig, AccountConfig } from "../config/schema.js";
import { resolveHorizonUrl, resolveExplorerUrl } from "../config/schema.js";
import { CursorStore } from "./cursor-store.js";
import { passesFilters } from "../filters/filters.js";
import { formatAsset } from "../util/format.js";
import type { Notifier, PaymentEvent } from "../notifiers/types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StreamCloseFunction = () => void;

export type WatcherEventMap = {
  payment: (event: PaymentEvent) => void;
  error: (err: Error, account: string) => void;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 60_000;

// ---------------------------------------------------------------------------
// Supported operation types (type-narrowed from SDK)
// ---------------------------------------------------------------------------

type SupportedOp =
  | Horizon.ServerApi.PaymentOperationRecord
  | Horizon.ServerApi.PathPaymentOperationRecord
  | Horizon.ServerApi.PathPaymentStrictSendOperationRecord
  | Horizon.ServerApi.CreateAccountOperationRecord;

function isSupportedOp(
  op: Horizon.ServerApi.OperationRecord,
): op is SupportedOp {
  return (
    op.type === "payment" ||
    op.type === "path_payment_strict_receive" ||
    op.type === "path_payment_strict_send" ||
    op.type === "create_account"
  );
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

function normaliseOperation(
  op: SupportedOp,
  account: AccountConfig,
  network: "testnet" | "mainnet",
): PaymentEvent {
  let from: string;
  let to: string;
  let asset: string;
  let amount: string;
  let type: PaymentEvent["type"];

  if (op.type === "create_account") {
    const ca = op as Horizon.ServerApi.CreateAccountOperationRecord;
    from = ca.funder;
    to = ca.account;
    asset = "XLM";
    amount = ca.starting_balance;
    type = "create_account";
  } else if (
    op.type === "path_payment_strict_send" ||
    op.type === "path_payment_strict_receive"
  ) {
    const pp = op as
      | Horizon.ServerApi.PathPaymentOperationRecord
      | Horizon.ServerApi.PathPaymentStrictSendOperationRecord;
    from = pp.from;
    to = pp.to;
    type = op.type as PaymentEvent["type"];
    // Use destination asset/amount as the canonical value
    if ("asset_type" in pp) {
      asset = formatAsset(pp.asset_type, pp.asset_code, pp.asset_issuer);
      amount = pp.amount;
    } else {
      asset = "XLM";
      amount = "0";
    }
  } else {
    // plain payment
    const pay = op as Horizon.ServerApi.PaymentOperationRecord;
    from = pay.from;
    to = pay.to;
    asset = formatAsset(pay.asset_type, pay.asset_code, pay.asset_issuer);
    amount = pay.amount;
    type = "payment";
  }

  return {
    id: op.id,
    type,
    from,
    to,
    asset,
    amount,
    createdAt: op.created_at,
    txHash: op.transaction_hash,
    account: account.address,
    label: account.label,
    network,
    explorerUrl: resolveExplorerUrl(op.transaction_hash, network),
  };
}

// ---------------------------------------------------------------------------
// AccountWatcher – watches a single account
// ---------------------------------------------------------------------------

class AccountWatcher {
  private readonly server: Horizon.Server;
  private readonly account: AccountConfig;
  private readonly config: LumenWatchConfig;
  private readonly cursorStore: CursorStore;
  private readonly notifiers: Notifier[];
  private readonly logger: Logger;

  private closeStream: StreamCloseFunction | null = null;
  private backoffMs = MIN_BACKOFF_MS;
  private stopped = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    server: Horizon.Server,
    account: AccountConfig,
    config: LumenWatchConfig,
    cursorStore: CursorStore,
    notifiers: Notifier[],
    logger: Logger,
  ) {
    this.server = server;
    this.account = account;
    this.config = config;
    this.cursorStore = cursorStore;
    this.notifiers = notifiers;
    this.logger = logger.child({ account: account.address, label: account.label });
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.closeStream?.();
    this.closeStream = null;
  }

  private connect(): void {
    if (this.stopped) return;

    const cursor = this.cursorStore.get(this.account.address);
    this.logger.info({ cursor }, "Starting stream");

    try {
      this.closeStream = this.server
        .operations()
        .forAccount(this.account.address)
        .cursor(cursor)
        .stream({
          onmessage: (op) => this.handleOperation(op as unknown as Horizon.ServerApi.OperationRecord),
          onerror: (err) => {
            this.logger.warn({ err: String(err) }, "Stream error, scheduling reconnect");
            this.closeStream?.();
            this.closeStream = null;
            this.scheduleReconnect();
          },
        });
    } catch (err) {
      this.logger.error({ err: String(err) }, "Failed to open stream, scheduling reconnect");
      this.scheduleReconnect();
    }
  }

  private handleOperation(op: Horizon.ServerApi.OperationRecord): void {
    if (!isSupportedOp(op)) return;

    const event = normaliseOperation(op, this.account, this.config.network);

    if (!passesFilters(event, this.config.filters)) return;

    // Save cursor immediately after processing
    this.cursorStore.set(this.account.address, op.paging_token);
    // Reset backoff on successful message
    this.backoffMs = MIN_BACKOFF_MS;

    this.logger.debug({ id: event.id, type: event.type }, "Payment event");

    // Fan out to all notifiers; errors are isolated
    for (const notifier of this.notifiers) {
      notifier.send(event).catch((err: unknown) => {
        this.logger.error(
          { notifier: notifier.name, err: String(err) },
          "Notifier failed",
        );
      });
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;

    this.logger.info(
      { backoffMs: this.backoffMs },
      `Reconnecting in ${this.backoffMs}ms`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.backoffMs);

    // Exponential backoff with cap
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
  }
}

// ---------------------------------------------------------------------------
// Watcher – manages all AccountWatchers
// ---------------------------------------------------------------------------

export interface WatcherOptions {
  config: LumenWatchConfig;
  notifiers: Notifier[];
  /** Override the pino logger (useful for tests) */
  logger?: Logger;
  /** Override the cursor store path */
  cursorFile?: string;
}

export class Watcher {
  private readonly config: LumenWatchConfig;
  private readonly notifiers: Notifier[];
  private readonly cursorStore: CursorStore;
  private readonly logger: Logger;
  private readonly server: Horizon.Server;
  private readonly accountWatchers: AccountWatcher[] = [];

  constructor(options: WatcherOptions) {
    this.config = options.config;
    this.notifiers = options.notifiers;

    this.logger =
      options.logger ??
      pino({
        level: process.env["LOG_LEVEL"] ?? "info",
        transport:
          process.env["NODE_ENV"] !== "production"
            ? { target: "pino-pretty", options: { colorize: true } }
            : undefined,
      });

    const cursorFile = options.cursorFile ?? this.config.cursorFile;
    this.cursorStore = new CursorStore(cursorFile);

    const horizonUrl = resolveHorizonUrl(this.config);
    this.logger.info({ horizonUrl, network: this.config.network }, "Initialising Horizon server");
    this.server = new Horizon.Server(horizonUrl);
  }

  start(): void {
    this.logger.info(
      { accounts: this.config.accounts.map((a) => a.address) },
      `Watching ${this.config.accounts.length} account(s)`,
    );

    for (const account of this.config.accounts) {
      const aw = new AccountWatcher(
        this.server,
        account,
        this.config,
        this.cursorStore,
        this.notifiers,
        this.logger,
      );
      this.accountWatchers.push(aw);
      aw.start();
    }
  }

  stop(): void {
    this.logger.info("Stopping all watchers");
    for (const aw of this.accountWatchers) {
      aw.stop();
    }
    this.accountWatchers.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Factory function (library API)
// ---------------------------------------------------------------------------

export function createWatcher(options: WatcherOptions): Watcher {
  return new Watcher(options);
}
