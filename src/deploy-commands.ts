import { REST, Routes } from "discord.js";
import { getCommands } from "./utils/index.js";
import { env } from "./env.js";

const rest = new REST().setToken(env.BOT_TOKEN);

const commands = (await getCommands()).map((command) => command.data.toJSON());

try {
  console.log(
    `Started refreshing ${commands.length} application (/) commands.`
  );

  // The put method is used to fully refresh all commands in the guild with the current set
  const data: any = await rest.put(
    Routes.applicationGuildCommands(env.APPLICATION_ID, env.GUILD_ID),
    {
      body: commands,
    }
  );

  console.log(`Successfully reloaded ${data.length} application (/) commands.`);
} catch (error) {
  // And of course, make sure you catch and log any errors!
  console.error(error);
}
