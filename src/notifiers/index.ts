/**
 * Factory: build Notifier instances from config.
 */

import type { NotifierConfig } from "../config/schema.js";
import type { Notifier } from "./types.js";
import { ConsoleNotifier } from "./console.js";
import { WebhookNotifier } from "./webhook.js";
import { DiscordNotifier } from "./discord.js";

export function buildNotifiers(configs: NotifierConfig[]): Notifier[] {
  return configs.map((cfg) => {
    switch (cfg.type) {
      case "console":
        return new ConsoleNotifier();
      case "webhook":
        return new WebhookNotifier(cfg);
      case "discord":
        return new DiscordNotifier(cfg);
    }
  });
}
