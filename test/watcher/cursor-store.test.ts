import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { CursorStore } from "../../src/watcher/cursor-store.js";

const TMP_DIR = "/tmp/lumen-watch-cursor-tests";
let counter = 0;

function tmpFile(): string {
  return resolve(`${TMP_DIR}/cursors-${++counter}.json`);
}

beforeEach(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

describe("CursorStore", () => {
  it("returns 'now' for an unknown account", () => {
    const store = new CursorStore(tmpFile());
    expect(store.get("GABC")).toBe("now");
  });

  it("persists and retrieves a cursor", () => {
    const file = tmpFile();
    const store = new CursorStore(file);
    store.set("GABC", "12345-0");

    // Re-load from disk
    const store2 = new CursorStore(file);
    expect(store2.get("GABC")).toBe("12345-0");
  });

  it("overwrites an existing cursor", () => {
    const file = tmpFile();
    const store = new CursorStore(file);
    store.set("GABC", "100-0");
    store.set("GABC", "200-0");

    expect(store.get("GABC")).toBe("200-0");
  });

  it("deletes a cursor (returns 'now' after)", () => {
    const file = tmpFile();
    const store = new CursorStore(file);
    store.set("GABC", "100-0");
    store.delete("GABC");

    expect(store.get("GABC")).toBe("now");

    // Persisted correctly
    const store2 = new CursorStore(file);
    expect(store2.get("GABC")).toBe("now");
  });

  it("stores multiple accounts independently", () => {
    const file = tmpFile();
    const store = new CursorStore(file);
    store.set("GABC", "100-0");
    store.set("GDEF", "200-0");

    expect(store.get("GABC")).toBe("100-0");
    expect(store.get("GDEF")).toBe("200-0");
  });

  it("returns defensive copy from all()", () => {
    const file = tmpFile();
    const store = new CursorStore(file);
    store.set("GABC", "100-0");

    const snapshot = store.all();
    snapshot["GABC"] = "mutated";

    // Original not mutated
    expect(store.get("GABC")).toBe("100-0");
  });

  it("starts fresh if the cursor file contains invalid JSON", () => {
    const file = tmpFile();
    writeFileSync(file, "{ corrupted json");
    const store = new CursorStore(file);
    expect(store.get("GABC")).toBe("now");
  });

  it("starts fresh if the cursor file contains a non-object", () => {
    const file = tmpFile();
    writeFileSync(file, JSON.stringify([1, 2, 3]));
    const store = new CursorStore(file);
    expect(store.get("GABC")).toBe("now");
  });

  it("ignores non-string values when loading", () => {
    const file = tmpFile();
    writeFileSync(file, JSON.stringify({ GABC: 12345, GDEF: "valid-cursor" }));
    const store = new CursorStore(file);
    expect(store.get("GABC")).toBe("now");
    expect(store.get("GDEF")).toBe("valid-cursor");
  });

  it("creates the file and any parent directories on first set", () => {
    const file = `${TMP_DIR}/nested/deep/cursors-${++counter}.json`;
    const store = new CursorStore(file);
    store.set("GABC", "1");
    expect(existsSync(file)).toBe(true);
  });
});
