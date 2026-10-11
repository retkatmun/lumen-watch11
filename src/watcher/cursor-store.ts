/**
 * File-based cursor store.
 *
 * Stores the last seen paging token for each watched account so that the
 * watcher can resume from where it left off after a restart.
 *
 * The cursor file is a JSON object mapping account address → paging token:
 * { "GABC...": "1234567890-0", "GDEF...": "now" }
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";

export type CursorMap = Record<string, string>;

export class CursorStore {
  private readonly filePath: string;
  private cursors: CursorMap;

  constructor(filePath: string) {
    this.filePath = resolve(filePath);
    this.cursors = this.load();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Returns the saved cursor for an account, or "now" if none is stored.
   */
  get(account: string): string {
    return this.cursors[account] ?? "now";
  }

  /**
   * Saves a cursor for an account and persists it to disk.
   */
  set(account: string, cursor: string): void {
    this.cursors[account] = cursor;
    this.persist();
  }

  /**
   * Removes the cursor for an account (resets to "now").
   */
  delete(account: string): void {
    delete this.cursors[account];
    this.persist();
  }

  /**
   * Returns all stored cursors (a defensive copy).
   */
  all(): CursorMap {
    return { ...this.cursors };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private load(): CursorMap {
    if (!existsSync(this.filePath)) return {};

    try {
      const raw = readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return {};
      }

      // Validate that all values are strings
      const result: CursorMap = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string") {
          result[k] = v;
        }
      }
      return result;
    } catch {
      // Corrupted file – start fresh
      return {};
    }
  }

  private persist(): void {
    const dir = dirname(this.filePath);
    mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.cursors, null, 2), "utf-8");
  }
}
