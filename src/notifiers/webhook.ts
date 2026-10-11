/**
 * Webhook notifier – POSTs a JSON payload to an HTTP endpoint.
 *
 * Retries up to 3 times with exponential backoff (1s, 2s, 4s).
 * Each attempt has a 5-second timeout.
 */

import type { Notifier, PaymentEvent } from "./types.js";
import type { WebhookNotifierConfig } from "../config/schema.js";

const MAX_RETRIES = 3;
const TIMEOUT_MS = 5_000;
const BASE_BACKOFF_MS = 1_000;

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

export class WebhookNotifier implements Notifier {
  readonly name: string;

  private readonly url: string;
  private readonly headers: Record<string, string>;

  constructor(config: WebhookNotifierConfig) {
    this.url = config.url;
    this.headers = config.headers ?? {};
    this.name = `webhook(${this.url})`;
  }

  async send(event: PaymentEvent): Promise<void> {
    const body = JSON.stringify(event);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "lumen-watch/0.1.0",
      ...this.headers,
    };

    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await fetchWithTimeout(
          this.url,
          { method: "POST", headers, body },
          TIMEOUT_MS,
        );

        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        return; // success
      } catch (err) {
        lastError = err;
        if (attempt < MAX_RETRIES - 1) {
          await sleep(BASE_BACKOFF_MS * Math.pow(2, attempt));
        }
      }
    }

    throw new Error(
      `Webhook delivery failed after ${MAX_RETRIES} attempts: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  }
}
