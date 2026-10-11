/**
 * Discord notifier – sends a rich embed to a Discord webhook.
 */

import type { Notifier, PaymentEvent } from "./types.js";
import type { DiscordNotifierConfig } from "../config/schema.js";
import { formatAmount, formatTimestamp, truncateAddress } from "../util/format.js";

const TIMEOUT_MS = 5_000;
// Stellar blue
const EMBED_COLOR = 0x7b68ee;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  footer: { text: string };
  timestamp: string;
  url: string;
}

interface DiscordPayload {
  embeds: DiscordEmbed[];
}

export class DiscordNotifier implements Notifier {
  readonly name = "discord";

  private readonly webhookUrl: string;

  constructor(config: DiscordNotifierConfig) {
    this.webhookUrl = config.webhookUrl;
  }

  async send(event: PaymentEvent): Promise<void> {
    const isIncoming = event.to === event.account;
    const direction = isIncoming ? "📥 Incoming Payment" : "📤 Outgoing Payment";
    const label = event.label ? ` — ${event.label}` : "";

    const embed: DiscordEmbed = {
      title: `${direction}${label}`,
      description: `**${formatAmount(event.amount)} ${event.asset}**`,
      color: EMBED_COLOR,
      url: event.explorerUrl,
      fields: [
        {
          name: "Account",
          value: `\`${truncateAddress(event.account)}\``,
          inline: true,
        },
        {
          name: "Network",
          value: event.network,
          inline: true,
        },
        {
          name: "From",
          value: `\`${truncateAddress(event.from)}\``,
          inline: false,
        },
        {
          name: "To",
          value: `\`${truncateAddress(event.to)}\``,
          inline: false,
        },
        {
          name: "Transaction",
          value: `[View on Stellar Expert](${event.explorerUrl})`,
          inline: false,
        },
      ],
      footer: { text: "lumen-watch" },
      timestamp: formatTimestamp(event.createdAt),
    };

    const payload: DiscordPayload = { embeds: [embed] };

    const MAX_RETRIES = 3;
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await fetchWithTimeout(
          this.webhookUrl,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "lumen-watch/0.1.0",
            },
            body: JSON.stringify(payload),
          },
          TIMEOUT_MS,
        );

        // Discord returns 204 No Content on success
        if (!res.ok && res.status !== 204) {
          throw new Error(`Discord API error: ${res.status} ${res.statusText}`);
        }
        return;
      } catch (err) {
        lastError = err;
        if (attempt < MAX_RETRIES - 1) {
          await sleep(1_000 * Math.pow(2, attempt));
        }
      }
    }

    throw new Error(
      `Discord delivery failed after ${MAX_RETRIES} attempts: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  }
}
