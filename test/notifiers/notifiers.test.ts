import { describe, it, expect, vi } from "vitest";
import type { PaymentEvent } from "../../src/notifiers/types.js";
import { ConsoleNotifier } from "../../src/notifiers/console.js";
import { WebhookNotifier } from "../../src/notifiers/webhook.js";
import { DiscordNotifier } from "../../src/notifiers/discord.js";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<PaymentEvent> = {}): PaymentEvent {
  return {
    id: "1",
    type: "payment",
    from: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNX",
    to: "GBVKJBLEUQIAPE5NSMYCZS3FVNMYZGYECJXHOOZMQNE5NSMYCZS3FVA1",
    asset: "XLM",
    amount: "100.0000000",
    createdAt: "2024-01-15T10:00:00Z",
    txHash: "abc123deadbeef",
    account: "GBVKJBLEUQIAPE5NSMYCZS3FVNMYZGYECJXHOOZMQNE5NSMYCZS3FVA1",
    network: "testnet",
    explorerUrl: "https://stellar.expert/explorer/testnet/tx/abc123deadbeef",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ConsoleNotifier
// ---------------------------------------------------------------------------

describe("ConsoleNotifier", () => {
  it("has name 'console'", () => {
    const n = new ConsoleNotifier();
    expect(n.name).toBe("console");
  });

  it("writes to stdout without throwing", async () => {
    const written: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array) => {
      written.push(typeof chunk === "string" ? chunk : "");
      return true;
    };

    try {
      await new ConsoleNotifier().send(makeEvent());
      expect(written.join("")).toContain("XLM");
    } finally {
      process.stdout.write = original;
    }
  });

  it("shows incoming arrow for incoming payment", async () => {
    const written: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array) => {
      written.push(typeof chunk === "string" ? chunk : "");
      return true;
    };

    try {
      const event = makeEvent({
        to: "GBVKJBLEUQIAPE5NSMYCZS3FVNMYZGYECJXHOOZMQNE5NSMYCZS3FVA1",
        account: "GBVKJBLEUQIAPE5NSMYCZS3FVNMYZGYECJXHOOZMQNE5NSMYCZS3FVA1",
      });
      await new ConsoleNotifier().send(event);
      // Green arrow ▲ for incoming
      expect(written.join("")).toContain("▲");
    } finally {
      process.stdout.write = original;
    }
  });
});

// ---------------------------------------------------------------------------
// WebhookNotifier
// ---------------------------------------------------------------------------

describe("WebhookNotifier", () => {
  it("has a name including the URL", () => {
    const n = new WebhookNotifier({ type: "webhook", url: "https://example.com/hook" });
    expect(n.name).toContain("https://example.com/hook");
  });

  it("POSTs JSON to the configured URL", async () => {
    const requests: { url: string; body: string }[] = [];

    vi.stubGlobal("fetch", async (url: string, opts: RequestInit) => {
      requests.push({ url: url as string, body: opts.body as string });
      return { ok: true, status: 200 } as Response;
    });

    try {
      await new WebhookNotifier({ type: "webhook", url: "https://example.com/hook" }).send(
        makeEvent(),
      );
      expect(requests).toHaveLength(1);
      expect(requests[0]?.url).toBe("https://example.com/hook");
      const body = JSON.parse(requests[0]?.body ?? "{}") as PaymentEvent;
      expect(body.asset).toBe("XLM");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("retries on failure and eventually throws", async () => {
    let callCount = 0;
    vi.stubGlobal("fetch", async () => {
      callCount++;
      return { ok: false, status: 503, statusText: "Service Unavailable" } as Response;
    });

    try {
      await expect(
        new WebhookNotifier({ type: "webhook", url: "https://example.com/hook" }).send(
          makeEvent(),
        ),
      ).rejects.toThrow("failed after");
      expect(callCount).toBe(3); // MAX_RETRIES
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("sends custom headers", async () => {
    const headers: Record<string, string>[] = [];
    vi.stubGlobal("fetch", async (_url: string, opts: RequestInit) => {
      headers.push(opts.headers as Record<string, string>);
      return { ok: true, status: 200 } as Response;
    });

    try {
      await new WebhookNotifier({
        type: "webhook",
        url: "https://example.com/hook",
        headers: { "X-Custom": "value" },
      }).send(makeEvent());
      expect(headers[0]?.["X-Custom"]).toBe("value");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// ---------------------------------------------------------------------------
// DiscordNotifier
// ---------------------------------------------------------------------------

describe("DiscordNotifier", () => {
  it("has name 'discord'", () => {
    expect(
      new DiscordNotifier({
        type: "discord",
        webhookUrl: "https://discord.com/api/webhooks/1/token",
      }).name,
    ).toBe("discord");
  });

  it("POSTs an embed payload", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal("fetch", async (_url: string, opts: RequestInit) => {
      bodies.push(JSON.parse(opts.body as string));
      return { ok: true, status: 204 } as Response;
    });

    try {
      await new DiscordNotifier({
        type: "discord",
        webhookUrl: "https://discord.com/api/webhooks/1/token",
      }).send(makeEvent());

      expect(bodies).toHaveLength(1);
      const payload = bodies[0] as { embeds: { title: string }[] };
      expect(payload.embeds[0]?.title).toContain("Payment");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("retries on failure and eventually throws", async () => {
    let callCount = 0;
    vi.stubGlobal("fetch", async () => {
      callCount++;
      return { ok: false, status: 500, statusText: "Server Error" } as Response;
    });

    try {
      await expect(
        new DiscordNotifier({
          type: "discord",
          webhookUrl: "https://discord.com/api/webhooks/1/token",
        }).send(makeEvent()),
      ).rejects.toThrow("failed after");
      expect(callCount).toBe(3);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// ---------------------------------------------------------------------------
// Notifier error isolation
// ---------------------------------------------------------------------------

describe("Notifier error isolation", () => {
  it("a failing notifier does not block other notifiers", async () => {
    const results: string[] = [];

    const failing = {
      name: "failing",
      send: async () => {
        throw new Error("boom");
      },
    };

    const succeeding = {
      name: "succeeding",
      send: async () => {
        results.push("ok");
      },
    };

    const event = makeEvent();
    const notifiers = [failing, succeeding];

    // Simulate the watcher's isolation pattern
    for (const notifier of notifiers) {
      await notifier.send(event).catch(() => {
        results.push("caught-" + notifier.name);
      });
    }

    expect(results).toContain("caught-failing");
    expect(results).toContain("ok");
  });
});
