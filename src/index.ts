import { Client, Collection, GatewayIntentBits } from "discord.js";
import { env } from "./env.js";
import { getCommands, registerEventHandlers } from "./utils/index.js";
import express from "express";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.cooldowns = new Collection();

const commands = new Collection(
  (await getCommands()).map((cmd) => [cmd.data.name, cmd])
);
client.commands = new Collection(commands);

await registerEventHandlers(client);

client.login(env.BOT_TOKEN);

const assetsServer = express();

if (env.VERBOSE_LOGGING) {
  assetsServer.use((req, _, next) => {
    console.dir(req);
    next();
  });
}

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
  console.log(
    `Assets static server listening on port ${env.ASSETS_SERVER_PORT}`
  );
});
