/**
 * lumen-watch public library API.
 *
 * @example
 * ```ts
 * import { createWatcher, loadConfig, buildNotifiers } from "lumen-watch";
 *
 * const config = loadConfig("./lumen-watch.config.json");
 * const notifiers = buildNotifiers(config.notifiers);
 * const watcher = createWatcher({ config, notifiers });
 * watcher.start();
 * ```
 */

// Config
export {
  ConfigSchema,
  loadConfig,
  resolveHorizonUrl,
  resolveExplorerUrl,
} from "./config/schema.js";
export type {
  LumenWatchConfig,
  AccountConfig,
  FiltersConfig,
  NotifierConfig,
  ConsoleNotifierConfig,
  WebhookNotifierConfig,
  DiscordNotifierConfig,
} from "./config/schema.js";

// Notifier types and implementations
export type { Notifier, PaymentEvent } from "./notifiers/types.js";
export { ConsoleNotifier } from "./notifiers/console.js";
export { WebhookNotifier } from "./notifiers/webhook.js";
export { DiscordNotifier } from "./notifiers/discord.js";
export { buildNotifiers } from "./notifiers/index.js";

// Filters
export {
  passesFilters,
  passesAssetFilter,
  passesMinAmountFilter,
  passesDirectionFilter,
} from "./filters/filters.js";

// Cursor store
export { CursorStore } from "./watcher/cursor-store.js";
export type { CursorMap } from "./watcher/cursor-store.js";

// Watcher
export { createWatcher, Watcher } from "./watcher/watcher.js";
export type { WatcherOptions } from "./watcher/watcher.js";

// Utilities
export {
  truncateAddress,
  formatAmount,
  formatAsset,
  formatPaymentLine,
  formatTimestamp,
} from "./util/format.js";
