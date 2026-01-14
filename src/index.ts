import {
  Client,
  Collection,
  DiscordAPIError,
  GatewayIntentBits,
} from "discord.js";
import { env } from "./env.js";
import express from "express";
import { getCommands, registerEventHandlers } from "./utils/discord.js";
import { logger, startLogRotation } from "./logging/logger.js";
import { initDb } from "./db/db.js";
import * as dbFunctions from "./db/crud.js";
import * as searchModule from "./db/search.js";
import { bindDbFunctions } from "./db/dbActions.js";

const db = await initDb();
const boundDbFunctions = bindDbFunctions(db, {
  ...dbFunctions,
  ...searchModule,
});

await startLogRotation(
  env.MAX_LOG_AGE_DAYS,
  env.MAX_LOG_SIZE_MB,
  env.MAX_LOG_ROTATIONS
);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.cooldowns = new Collection();

const commands = new Collection(
  (await getCommands()).map((cmd) => [cmd.data.name, cmd])
);
client.commands = new Collection(commands);

await registerEventHandlers(client, boundDbFunctions);

client.login(env.BOT_TOKEN);

const assetsServer = express();

assetsServer.use((req, _, next) => {
  logger.debug({ req });
  next();
});

assetsServer.use(
  express.static(env.ASSETS_DIR_PATH, {
    dotfiles: "deny",
    fallthrough: false,
    maxAge: "30d",
    immutable: true,
    index: false,
  })
);

assetsServer.listen(env.ASSETS_SERVER_PORT, () => {
  logger.info({ port: env.ASSETS_SERVER_PORT }, `static server listening`);
});

process.on("uncaughtException", (err) => {
  if (err instanceof DiscordAPIError) {
    switch (err.message) {
      case "Invalid Webhook Token":
        logger.error({ err }, "attempted to use old interaction");
        return;
      case "Unknown interaction":
        logger.error({ err }, "took too long to reply");
        return;
    }
  }
  logger.fatal({ err }, "uncaught exception detected");
  // If a graceful shutdown is not achieved after 1 second,
  // shut down the process completely
  setTimeout(() => {
    process.abort();
  }, 1000).unref();

  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "unhandled rejection");
});
