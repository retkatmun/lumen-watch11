import { describe, it, expect } from "vitest";
import {
  passesAssetFilter,
  passesMinAmountFilter,
  passesDirectionFilter,
  passesFilters,
} from "../../src/filters/filters.js";
import type { PaymentEvent } from "../../src/notifiers/types.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ACCOUNT = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNX";
const OTHER = "GBVKJBLEUQIAPE5NSMYCZS3FVNMYZGYECJXHOOZMQNE5NSMYCZS3FVA1";

function makeEvent(overrides: Partial<PaymentEvent> = {}): PaymentEvent {
  return {
    id: "1",
    type: "payment",
    from: OTHER,
    to: ACCOUNT,
    asset: "XLM",
    amount: "10.5",
    createdAt: "2024-01-01T00:00:00Z",
    txHash: "abc123",
    account: ACCOUNT,
    network: "testnet",
    explorerUrl: "https://stellar.expert/explorer/testnet/tx/abc123",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// passesAssetFilter
// ---------------------------------------------------------------------------

describe("passesAssetFilter", () => {
  it("passes all when assets list is empty", () => {
    expect(passesAssetFilter(makeEvent(), [])).toBe(true);
  });

  it("passes when asset matches", () => {
    expect(passesAssetFilter(makeEvent({ asset: "XLM" }), ["XLM"])).toBe(true);
  });

  it("rejects when asset does not match", () => {
    expect(passesAssetFilter(makeEvent({ asset: "USDC:GISSUER" }), ["XLM"])).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(passesAssetFilter(makeEvent({ asset: "USDC:GISSUER" }), ["usdc"])).toBe(true);
  });

  it("matches asset with issuer suffix against code only", () => {
    expect(passesAssetFilter(makeEvent({ asset: "USDC:GABCDEF" }), ["USDC"])).toBe(true);
  });

  it("passes when one of multiple assets matches", () => {
    expect(passesAssetFilter(makeEvent({ asset: "USDC:G123" }), ["XLM", "USDC"])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// passesMinAmountFilter
// ---------------------------------------------------------------------------

describe("passesMinAmountFilter", () => {
  it("passes when amount is exactly minAmount", () => {
    expect(passesMinAmountFilter(makeEvent({ amount: "10.0" }), "10")).toBe(true);
  });

  it("passes when amount exceeds minAmount", () => {
    expect(passesMinAmountFilter(makeEvent({ amount: "100.5" }), "10")).toBe(true);
  });

  it("rejects when amount is below minAmount", () => {
    expect(passesMinAmountFilter(makeEvent({ amount: "0.5" }), "1")).toBe(false);
  });

  it("passes on invalid amount strings (graceful)", () => {
    expect(passesMinAmountFilter(makeEvent({ amount: "NaN" }), "1")).toBe(true);
  });

  it("passes on invalid minAmount string (graceful)", () => {
    expect(passesMinAmountFilter(makeEvent({ amount: "10" }), "abc")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// passesDirectionFilter
// ---------------------------------------------------------------------------

describe("passesDirectionFilter", () => {
  it("passes both for 'both'", () => {
    expect(passesDirectionFilter(makeEvent({ to: ACCOUNT }), "both")).toBe(true);
    expect(passesDirectionFilter(makeEvent({ from: ACCOUNT, to: OTHER }), "both")).toBe(true);
  });

  it("passes incoming when watched account is destination", () => {
    expect(passesDirectionFilter(makeEvent({ to: ACCOUNT }), "incoming")).toBe(true);
  });

  it("rejects incoming when watched account is source", () => {
    expect(
      passesDirectionFilter(makeEvent({ from: ACCOUNT, to: OTHER, account: ACCOUNT }), "incoming"),
    ).toBe(false);
  });

  it("passes outgoing when watched account is source", () => {
    const event = makeEvent({ from: ACCOUNT, to: OTHER, account: ACCOUNT });
    expect(passesDirectionFilter(event, "outgoing")).toBe(true);
  });

  it("rejects outgoing when watched account is destination", () => {
    expect(passesDirectionFilter(makeEvent({ to: ACCOUNT }), "outgoing")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// passesFilters (composite)
// ---------------------------------------------------------------------------

describe("passesFilters", () => {
  it("passes when no filters configured", () => {
    expect(passesFilters(makeEvent(), undefined)).toBe(true);
  });

  it("passes when empty filters object", () => {
    expect(passesFilters(makeEvent(), {})).toBe(true);
  });

  it("rejects when asset filter fails", () => {
    expect(passesFilters(makeEvent({ asset: "USDC:G123" }), { assets: ["XLM"] })).toBe(false);
  });

  it("rejects when minAmount filter fails", () => {
    expect(passesFilters(makeEvent({ amount: "0.01" }), { minAmount: "1" })).toBe(false);
  });

  it("rejects when direction filter fails", () => {
    const event = makeEvent({ from: ACCOUNT, to: OTHER, account: ACCOUNT });
    expect(passesFilters(event, { direction: "incoming" })).toBe(false);
  });

  it("passes when all filters match", () => {
    const event = makeEvent({ asset: "XLM", amount: "50", to: ACCOUNT });
    expect(
      passesFilters(event, { assets: ["XLM"], minAmount: "10", direction: "incoming" }),
    ).toBe(true);
  });
});
