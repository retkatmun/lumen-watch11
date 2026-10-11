/**
 * Console notifier – prints payment events to stdout with colour.
 */

import type { Notifier, PaymentEvent } from "./types.js";
import { formatAmount, formatTimestamp, truncateAddress } from "../util/format.js";

// ANSI colour codes
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";

export class ConsoleNotifier implements Notifier {
  readonly name = "console";

  async send(event: PaymentEvent): Promise<void> {
    const isIncoming = event.to === event.account;
    const arrow = isIncoming ? `${GREEN}▲${RESET}` : `${YELLOW}▼${RESET}`;
    const label = event.label ? ` (${event.label})` : "";

    const lines = [
      `${arrow} ${BOLD}${formatAmount(event.amount)} ${event.asset}${RESET}`,
      `   Account : ${CYAN}${event.account}${RESET}${label}`,
      `   From    : ${truncateAddress(event.from)}`,
      `   To      : ${truncateAddress(event.to)}`,
      `   Time    : ${formatTimestamp(event.createdAt)}`,
      `   Tx      : ${DIM}${event.explorerUrl}${RESET}`,
    ];

    process.stdout.write(lines.join("\n") + "\n\n");
  }
}
