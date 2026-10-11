/**
 * Formatting utilities for amounts, addresses, and assets.
 */

// ---------------------------------------------------------------------------
// Address formatting
// ---------------------------------------------------------------------------

/**
 * Truncates a Stellar public key for display: GABC...WXYZ
 */
export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

// ---------------------------------------------------------------------------
// Amount formatting
// ---------------------------------------------------------------------------

/**
 * Formats a raw Stellar amount string with a fixed number of decimal places,
 * stripping trailing zeros unless `keepTrailingZeros` is true.
 *
 * Stellar amounts are represented as strings in the SDK (e.g. "10.0000000").
 */
export function formatAmount(
  amount: string,
  decimals = 7,
  keepTrailingZeros = false,
): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;

  const formatted = num.toFixed(decimals);
  if (keepTrailingZeros) return formatted;

  // Strip trailing zeros but keep at least one decimal digit
  return formatted.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, ".0");
}

/**
 * Formats an asset as "XLM" or "USDC:GABC...".
 */
export function formatAsset(
  assetType: string,
  assetCode?: string,
  assetIssuer?: string,
): string {
  if (assetType === "native") return "XLM";
  if (!assetCode) return assetType;
  if (!assetIssuer) return assetCode;
  return `${assetCode}:${truncateAddress(assetIssuer)}`;
}

/**
 * Formats a full payment summary line, e.g.:
 * "→ GABC...WXYZ received 100.5 USDC from GDEF...UVWX"
 */
export function formatPaymentLine(
  direction: "in" | "out",
  watchedAddress: string,
  amount: string,
  asset: string,
  counterparty: string,
): string {
  const arrow = direction === "in" ? "→" : "←";
  const verb = direction === "in" ? "received" : "sent";
  const prep = direction === "in" ? "from" : "to";

  return (
    `${arrow} ${truncateAddress(watchedAddress)} ${verb} ` +
    `${formatAmount(amount)} ${asset} ${prep} ${truncateAddress(counterparty)}`
  );
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

/**
 * Returns an ISO-8601 date-time string in UTC.
 */
export function formatTimestamp(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toISOString();
}
