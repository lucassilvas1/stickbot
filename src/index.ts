import { Client, Collection, GatewayIntentBits } from "discord.js";
import { env } from "./env.js";
import { getCommands, registerEventHandlers } from "./utils/index.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = new Collection(
  (await getCommands()).map((cmd) => [cmd.data.name, cmd])
);
client.commands = new Collection(commands);

await registerEventHandlers(client);

client.login(env.BOT_TOKEN);
