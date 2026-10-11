/**
 * Payment event filters.
 *
 * Filters are applied in order: asset → minAmount → direction.
 * All active filters must pass for a payment to be forwarded to notifiers.
 */

import type { FiltersConfig } from "../config/schema.js";
import type { PaymentEvent } from "../notifiers/types.js";

// ---------------------------------------------------------------------------
// Individual filter predicates
// ---------------------------------------------------------------------------

/**
 * Returns true if the event's asset matches the whitelist.
 * A match is either an exact asset code (e.g. "USDC") or "XLM".
 */
export function passesAssetFilter(
  event: PaymentEvent,
  assets: string[],
): boolean {
  if (assets.length === 0) return true;
  // event.asset is formatted as "XLM" or "USDC:GISSUER..."
  const eventCode = event.asset.split(":")[0] ?? "";
  return assets.some(
    (a) => a.toUpperCase() === eventCode.toUpperCase(),
  );
}

/**
 * Returns true if the event's amount >= minAmount.
 */
export function passesMinAmountFilter(
  event: PaymentEvent,
  minAmount: string,
): boolean {
  const eventAmt = parseFloat(event.amount);
  const minAmt = parseFloat(minAmount);
  if (isNaN(eventAmt) || isNaN(minAmt)) return true;
  return eventAmt >= minAmt;
}

/**
 * Returns true if the event's direction matches the configured direction.
 *
 * "incoming" – the watched account is the destination
 * "outgoing" – the watched account is the source
 * "both"     – always pass
 */
export function passesDirectionFilter(
  event: PaymentEvent,
  direction: "incoming" | "outgoing" | "both",
): boolean {
  if (direction === "both") return true;

  if (direction === "incoming") {
    return event.to === event.account;
  }
  // outgoing
  return event.from === event.account;
}

// ---------------------------------------------------------------------------
// Composite filter
// ---------------------------------------------------------------------------

/**
 * Returns true if the event passes all configured filters.
 * Accepts `undefined` filters (no filtering applied).
 */
export function passesFilters(
  event: PaymentEvent,
  filters: FiltersConfig,
): boolean {
  if (!filters) return true;

  if (filters.assets && filters.assets.length > 0) {
    if (!passesAssetFilter(event, filters.assets)) return false;
  }

  if (filters.minAmount !== undefined) {
    if (!passesMinAmountFilter(event, filters.minAmount)) return false;
  }

  if (filters.direction !== undefined) {
    if (!passesDirectionFilter(event, filters.direction)) return false;
  }

  return true;
}
