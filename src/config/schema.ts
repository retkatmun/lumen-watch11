/**
 * Config schema and loader for lumen-watch.
 *
 * Reads a JSON config file, validates it with Zod, and returns a typed config object.
 * No secrets are handled here — only public Stellar addresses.
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Stellar public key validator (G... 56-char base32)
// ---------------------------------------------------------------------------

const stellarAddressRegex = /^G[A-Z2-7]{55}$/;

const StellarAddressSchema = z
  .string()
  .regex(stellarAddressRegex, "Must be a valid Stellar public key (G...)");

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

const AccountSchema = z.object({
  address: StellarAddressSchema,
  label: z.string().optional(),
});

const FiltersSchema = z
  .object({
    /**
     * Whitelist of asset codes to watch, e.g. ["XLM", "USDC"].
     * If omitted, all assets are accepted.
     */
    assets: z.array(z.string().min(1)).optional(),
    /**
     * Minimum payment amount (as decimal string) to trigger a notification.
     */
    minAmount: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "minAmount must be a positive decimal string")
      .optional(),
    /** Which direction of payments to watch. Defaults to "both". */
    direction: z.enum(["incoming", "outgoing", "both"]).optional(),
  })
  .optional();

const ConsoleNotifierSchema = z.object({
  type: z.literal("console"),
});

const WebhookNotifierSchema = z.object({
  type: z.literal("webhook"),
  url: z.string().url("Webhook URL must be a valid URL"),
  headers: z.record(z.string()).optional(),
});

const DiscordNotifierSchema = z.object({
  type: z.literal("discord"),
  webhookUrl: z.string().url("Discord webhook URL must be a valid URL"),
});

const NotifierSchema = z.discriminatedUnion("type", [
  ConsoleNotifierSchema,
  WebhookNotifierSchema,
  DiscordNotifierSchema,
]);

// ---------------------------------------------------------------------------
// Root config schema
// ---------------------------------------------------------------------------

export const ConfigSchema = z.object({
  /** "testnet" (default) or "mainnet". */
  network: z.enum(["testnet", "mainnet"]).default("testnet"),
  /**
   * Override the Horizon base URL.
   * Defaults to https://horizon-testnet.stellar.org or https://horizon.stellar.org.
   */
  horizonUrl: z.string().url().optional(),
  /** One or more Stellar accounts to watch. */
  accounts: z
    .array(AccountSchema)
    .min(1, "At least one account is required"),
  /** Payment filters. */
  filters: FiltersSchema,
  /** One or more notifiers. */
  notifiers: z
    .array(NotifierSchema)
    .min(1, "At least one notifier is required"),
  /** Path to the cursor persistence file. */
  cursorFile: z.string().default(".lumen-watch-cursor.json"),
});

// ---------------------------------------------------------------------------
// Derived types
// ---------------------------------------------------------------------------

export type LumenWatchConfig = z.infer<typeof ConfigSchema>;
export type AccountConfig = z.infer<typeof AccountSchema>;
export type FiltersConfig = z.infer<typeof FiltersSchema>;
export type NotifierConfig = z.infer<typeof NotifierSchema>;
export type ConsoleNotifierConfig = z.infer<typeof ConsoleNotifierSchema>;
export type WebhookNotifierConfig = z.infer<typeof WebhookNotifierSchema>;
export type DiscordNotifierConfig = z.infer<typeof DiscordNotifierSchema>;

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export function loadConfig(filePath: string): LumenWatchConfig {
  const abs = resolve(filePath);

  if (!existsSync(abs)) {
    throw new Error(`Config file not found: ${abs}`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(abs, "utf-8"));
  } catch (err) {
    throw new Error(
      `Failed to parse config file as JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const result = ConfigSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".")} — ${i.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${issues}`);
  }

  return result.data;
}

// ---------------------------------------------------------------------------
// Horizon URL helper
// ---------------------------------------------------------------------------

export function resolveHorizonUrl(config: LumenWatchConfig): string {
  if (config.horizonUrl) return config.horizonUrl;
  return config.network === "mainnet"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org";
}

// ---------------------------------------------------------------------------
// Explorer URL helper
// ---------------------------------------------------------------------------

export function resolveExplorerUrl(
  txHash: string,
  network: "testnet" | "mainnet",
): string {
  const base = "https://stellar.expert/explorer";
  const net = network === "mainnet" ? "public" : "testnet";
  return `${base}/${net}/tx/${txHash}`;
}
