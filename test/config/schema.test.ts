import { describe, it, expect, afterEach } from "vitest";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { resolve } from "path";
import {
  ConfigSchema,
  loadConfig,
  resolveHorizonUrl,
  resolveExplorerUrl,
} from "../../src/config/schema.js";

// ---------------------------------------------------------------------------
// ConfigSchema.safeParse
// ---------------------------------------------------------------------------

describe("ConfigSchema", () => {
  const validConfig = {
    accounts: [{ address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNX" }],
    notifiers: [{ type: "console" }],
  };

  it("parses a minimal valid config with defaults", () => {
    const result = ConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.network).toBe("testnet");
    expect(result.data.cursorFile).toBe(".lumen-watch-cursor.json");
  });

  it("accepts mainnet network", () => {
    const result = ConfigSchema.safeParse({ ...validConfig, network: "mainnet" });
    expect(result.success).toBe(true);
  });

  it("rejects unknown network", () => {
    const result = ConfigSchema.safeParse({ ...validConfig, network: "futurenet" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid Stellar address", () => {
    const result = ConfigSchema.safeParse({
      ...validConfig,
      accounts: [{ address: "not-a-stellar-address" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects address starting with S (secret key)", () => {
    const result = ConfigSchema.safeParse({
      ...validConfig,
      accounts: [{ address: "SBCVMMCBEDB64TVJZFYJOJAERZC4YVVUOE6SYR2Y76CBTENGUSGWRRVO" }],
    });
    expect(result.success).toBe(false);
  });

  it("requires at least one account", () => {
    const result = ConfigSchema.safeParse({ ...validConfig, accounts: [] });
    expect(result.success).toBe(false);
  });

  it("requires at least one notifier", () => {
    const result = ConfigSchema.safeParse({ ...validConfig, notifiers: [] });
    expect(result.success).toBe(false);
  });

  it("accepts a webhook notifier with headers", () => {
    const result = ConfigSchema.safeParse({
      ...validConfig,
      notifiers: [
        {
          type: "webhook",
          url: "https://example.com/hook",
          headers: { Authorization: "Bearer token" },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a webhook notifier without url", () => {
    const result = ConfigSchema.safeParse({
      ...validConfig,
      notifiers: [{ type: "webhook" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a discord notifier", () => {
    const result = ConfigSchema.safeParse({
      ...validConfig,
      notifiers: [{ type: "discord", webhookUrl: "https://discord.com/api/webhooks/1/token" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional label on account", () => {
    const result = ConfigSchema.safeParse({
      ...validConfig,
      accounts: [
        {
          address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNX",
          label: "My account",
        },
      ],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.accounts[0]?.label).toBe("My account");
  });

  it("validates minAmount as decimal string", () => {
    const result = ConfigSchema.safeParse({
      ...validConfig,
      filters: { minAmount: "not-a-number" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid filters", () => {
    const result = ConfigSchema.safeParse({
      ...validConfig,
      filters: { assets: ["XLM", "USDC"], minAmount: "1.5", direction: "incoming" },
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// loadConfig
// ---------------------------------------------------------------------------

describe("loadConfig", () => {
  const tmpFile = resolve("/tmp/lumen-watch-test-config.json");

  afterEach(() => {
    if (existsSync(tmpFile)) unlinkSync(tmpFile);
  });

  it("loads and parses a valid config file", () => {
    writeFileSync(
      tmpFile,
      JSON.stringify({
        accounts: [{ address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNX" }],
        notifiers: [{ type: "console" }],
      }),
    );
    const config = loadConfig(tmpFile);
    expect(config.network).toBe("testnet");
  });

  it("throws on missing file", () => {
    expect(() => loadConfig("/tmp/does-not-exist-12345.json")).toThrow("not found");
  });

  it("throws on invalid JSON", () => {
    writeFileSync(tmpFile, "{ not json }");
    expect(() => loadConfig(tmpFile)).toThrow("Failed to parse");
  });

  it("throws with detailed error on invalid config", () => {
    writeFileSync(tmpFile, JSON.stringify({ accounts: [], notifiers: [] }));
    const err = (() => {
      try {
        loadConfig(tmpFile);
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("Invalid configuration");
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe("resolveHorizonUrl", () => {
  it("returns testnet URL for testnet", () => {
    const config = ConfigSchema.parse({
      accounts: [{ address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNX" }],
      notifiers: [{ type: "console" }],
    });
    expect(resolveHorizonUrl(config)).toBe("https://horizon-testnet.stellar.org");
  });

  it("returns mainnet URL for mainnet", () => {
    const config = ConfigSchema.parse({
      network: "mainnet",
      accounts: [{ address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNX" }],
      notifiers: [{ type: "console" }],
    });
    expect(resolveHorizonUrl(config)).toBe("https://horizon.stellar.org");
  });

  it("returns override URL when horizonUrl is set", () => {
    const config = ConfigSchema.parse({
      horizonUrl: "https://my-horizon.example.com",
      accounts: [{ address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNX" }],
      notifiers: [{ type: "console" }],
    });
    expect(resolveHorizonUrl(config)).toBe("https://my-horizon.example.com");
  });
});

describe("resolveExplorerUrl", () => {
  it("returns testnet URL", () => {
    const url = resolveExplorerUrl("abc123", "testnet");
    expect(url).toContain("testnet");
    expect(url).toContain("abc123");
  });

  it("returns mainnet URL", () => {
    const url = resolveExplorerUrl("abc123", "mainnet");
    expect(url).toContain("public");
  });
});
