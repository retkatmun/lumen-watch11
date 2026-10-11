/**
 * Core types shared across notifiers.
 */

// ---------------------------------------------------------------------------
// PaymentEvent – the normalised event passed to every notifier
// ---------------------------------------------------------------------------

export interface PaymentEvent {
  /** Horizon operation ID */
  id: string;
  /** Operation type */
  type:
    | "payment"
    | "path_payment_strict_send"
    | "path_payment_strict_receive"
    | "create_account";
  /** Source account (G...) */
  from: string;
  /** Destination account (G...) */
  to: string;
  /**
   * Asset formatted as "XLM" or "USDC:GISSUERADDRESS".
   * For create_account operations this is "XLM".
   */
  asset: string;
  /** Human-readable decimal amount string, e.g. "10.5000000" */
  amount: string;
  /** ISO-8601 UTC timestamp from Horizon */
  createdAt: string;
  /** Transaction hash */
  txHash: string;
  /** The watched account that triggered this event */
  account: string;
  /** Optional human label from config */
  label?: string;
  /** "testnet" or "mainnet" */
  network: "testnet" | "mainnet";
  /** Stellar Expert explorer URL */
  explorerUrl: string;
}

// ---------------------------------------------------------------------------
// Notifier interface
// ---------------------------------------------------------------------------

/**
 * A notifier receives a PaymentEvent and delivers it somewhere
 * (console, webhook, Discord, etc.).
 *
 * Implementations must be safe: they should catch their own errors internally
 * if they perform retries, but any unhandled rejection will be caught by the
 * watcher and logged without crashing the process.
 */
export interface Notifier {
  /** Unique human-readable name used in log output */
  readonly name: string;
  /**
   * Deliver the payment event.
   * @throws May throw on unrecoverable errors; the watcher handles isolation.
   */
  send(event: PaymentEvent): Promise<void>;
}
