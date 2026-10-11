import { describe, it, expect } from "vitest";
import {
  truncateAddress,
  formatAmount,
  formatAsset,
  formatPaymentLine,
  formatTimestamp,
} from "../../src/util/format.js";

describe("truncateAddress", () => {
  const addr = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNX";

  it("truncates a long address to GAAZ...CWNX (4 chars)", () => {
    const result = truncateAddress(addr, 4);
    expect(result).toBe("GAAZ...CWNX");
  });

  it("uses default 4-char truncation", () => {
    expect(truncateAddress(addr)).toBe("GAAZ...CWNX");
  });

  it("returns short strings unchanged", () => {
    expect(truncateAddress("GABC")).toBe("GABC");
  });
});

describe("formatAmount", () => {
  it("strips trailing zeros by default", () => {
    expect(formatAmount("10.0000000")).toBe("10.0");
  });

  it("keeps meaningful decimals", () => {
    expect(formatAmount("10.5000000")).toBe("10.5");
  });

  it("preserves non-zero decimals", () => {
    expect(formatAmount("0.0012345")).toBe("0.0012345");
  });

  it("keeps trailing zeros when requested", () => {
    expect(formatAmount("10.0000000", 7, true)).toBe("10.0000000");
  });

  it("handles integer string", () => {
    const result = formatAmount("100");
    expect(result).toMatch(/^100/);
  });

  it("returns original for NaN-like input", () => {
    expect(formatAmount("xyz")).toBe("xyz");
  });
});

describe("formatAsset", () => {
  it("returns XLM for native asset", () => {
    expect(formatAsset("native")).toBe("XLM");
  });

  it("returns asset code without issuer when no issuer", () => {
    expect(formatAsset("credit_alphanum4", "USDC")).toBe("USDC");
  });

  it("returns ASSETCODE:truncatedIssuer", () => {
    const issuer = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNX";
    const result = formatAsset("credit_alphanum4", "USDC", issuer);
    expect(result).toMatch(/^USDC:/);
    expect(result).toContain("...");
  });

  it("returns assetType as fallback when no code", () => {
    expect(formatAsset("credit_alphanum4")).toBe("credit_alphanum4");
  });
});

describe("formatPaymentLine", () => {
  const addr = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNX";
  const other = "GBVKJBLEUQIAPE5NSMYCZS3FVNMYZGYECJXHOOZMQNE5NSMYCZS3ABCD";

  it("shows arrow → for incoming", () => {
    const line = formatPaymentLine("in", addr, "100", "XLM", other);
    expect(line).toContain("→");
    expect(line).toContain("received");
    expect(line).toContain("from");
  });

  it("shows arrow ← for outgoing", () => {
    const line = formatPaymentLine("out", addr, "100", "XLM", other);
    expect(line).toContain("←");
    expect(line).toContain("sent");
    expect(line).toContain("to");
  });
});

describe("formatTimestamp", () => {
  it("formats a valid ISO string", () => {
    const result = formatTimestamp("2024-01-15T10:30:00Z");
    expect(result).toBe("2024-01-15T10:30:00.000Z");
  });

  it("returns original string for invalid date", () => {
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
  });
});
