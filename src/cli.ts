/**
 * lumen-watch CLI entry point.
 *
 * Commands:
 *   lumen-watch init                          Write example config to cwd
 *   lumen-watch validate -c <file>            Validate config, print errors
 *   lumen-watch start -c <file>              Start watching
 *   lumen-watch once <address> [--network]   Print last 10 payments and exit
 */

import { Command } from "commander";
import { writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { Horizon } from "@stellar/stellar-sdk";
import { loadConfig, ConfigSchema, resolveExplorerUrl } from "./config/schema.js";
import { buildNotifiers } from "./notifiers/index.js";
import { createWatcher } from "./watcher/watcher.js";
import { formatAmount, formatAsset, formatTimestamp, truncateAddress } from "./util/format.js";

// ---------------------------------------------------------------------------
// Example config for `init`
// ---------------------------------------------------------------------------

const EXAMPLE_CONFIG = {
  network: "testnet",
  accounts: [
    {
      address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNX",
      label: "Test account",
    },
  ],
  filters: {
    assets: ["XLM"],
    minAmount: "1",
    direction: "both",
  },
  notifiers: [{ type: "console" }],
  cursorFile: ".lumen-watch-cursor.json",
};

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name("lumen-watch")
  .description("Watch Stellar accounts and get real-time payment alerts")
  .version("0.1.0");

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

program
  .command("init")
  .description("Create an example lumen-watch.config.json in the current directory")
  .option("-f, --force", "Overwrite if the file already exists", false)
  .action((opts: { force: boolean }) => {
    const dest = resolve("lumen-watch.config.json");

    if (existsSync(dest) && !opts.force) {
      console.error(
        `Config file already exists: ${dest}\nUse --force to overwrite.`,
      );
      process.exit(1);
    }

    writeFileSync(dest, JSON.stringify(EXAMPLE_CONFIG, null, 2) + "\n", "utf-8");
    console.log(`✓ Created ${dest}`);
    console.log("Edit the file then run: lumen-watch start -c lumen-watch.config.json");
  });

// ---------------------------------------------------------------------------
// validate
// ---------------------------------------------------------------------------

program
  .command("validate")
  .description("Validate a config file and print any errors")
  .requiredOption("-c, --config <file>", "Path to config file")
  .action((opts: { config: string }) => {
    try {
      const config = loadConfig(opts.config);
      console.log(`✓ Config is valid`);
      console.log(`  Network  : ${config.network}`);
      console.log(`  Accounts : ${config.accounts.length}`);
      console.log(`  Notifiers: ${config.notifiers.map((n) => n.type).join(", ")}`);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------

program
  .command("start")
  .description("Start watching configured accounts")
  .requiredOption("-c, --config <file>", "Path to config file")
  .action((opts: { config: string }) => {
    let config;
    try {
      config = loadConfig(opts.config);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    const notifiers = buildNotifiers(config.notifiers);
    const watcher = createWatcher({ config, notifiers });

    watcher.start();

    // Graceful shutdown
    const shutdown = () => {
      console.log("\nShutting down…");
      watcher.stop();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });

// ---------------------------------------------------------------------------
// once
// ---------------------------------------------------------------------------

program
  .command("once")
  .description("Print the last 10 payments for an address and exit")
  .argument("<address>", "Stellar public key (G...)")
  .option("-n, --network <network>", "testnet or mainnet", "testnet")
  .option("--limit <n>", "Number of payments to fetch", "10")
  .action(async (address: string, opts: { network: string; limit: string }) => {
    // Validate address via schema
    const result = ConfigSchema.shape.accounts.element.shape.address.safeParse(address);
    if (!result.success) {
      console.error(`Invalid Stellar address: ${result.error.issues[0]?.message ?? "unknown"}`);
      process.exit(1);
    }

    if (opts.network !== "testnet" && opts.network !== "mainnet") {
      console.error('Network must be "testnet" or "mainnet"');
      process.exit(1);
    }

    const network = opts.network as "testnet" | "mainnet";
    const limit = Math.min(Math.max(parseInt(opts.limit, 10) || 10, 1), 200);

    const horizonUrl =
      network === "mainnet"
        ? "https://horizon.stellar.org"
        : "https://horizon-testnet.stellar.org";

    const server = new Horizon.Server(horizonUrl);

    try {
      const ops = await server
        .operations()
        .forAccount(address)
        .order("desc")
        .limit(limit)
        .call();

      const payments = ops.records.filter(
        (op) =>
          op.type === "payment" ||
          op.type === "path_payment_strict_receive" ||
          op.type === "path_payment_strict_send" ||
          op.type === "create_account",
      );

      if (payments.length === 0) {
        console.log("No payments found for this account.");
        return;
      }

      console.log(`\nLast ${payments.length} payment(s) for ${truncateAddress(address)}:\n`);

      for (const op of payments) {
        let from = "";
        let to = "";
        let asset = "";
        let amount = "";

        if (op.type === "create_account") {
          const ca = op as Horizon.ServerApi.CreateAccountOperationRecord;
          from = ca.funder;
          to = ca.account;
          asset = "XLM";
          amount = ca.starting_balance;
        } else if (
          op.type === "payment" ||
          op.type === "path_payment_strict_receive" ||
          op.type === "path_payment_strict_send"
        ) {
          const pay = op as Horizon.ServerApi.PaymentOperationRecord;
          from = pay.from;
          to = pay.to;
          asset = formatAsset(pay.asset_type, pay.asset_code, pay.asset_issuer);
          amount = pay.amount;
        }

        const isIncoming = to === address;
        const arrow = isIncoming ? "→" : "←";
        const explorerUrl = resolveExplorerUrl(op.transaction_hash, network);

        console.log(
          `${arrow} ${formatAmount(amount)} ${asset}` +
            `\n   Time: ${formatTimestamp(op.created_at)}` +
            `\n   From: ${truncateAddress(from)}  →  To: ${truncateAddress(to)}` +
            `\n   ${explorerUrl}\n`,
        );
      }
    } catch (err) {
      console.error(`Failed to fetch payments: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
