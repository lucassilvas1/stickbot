import { REST, Routes } from "discord.js";
import { getCommands } from "./utils/index.js";
import { env } from "./env.js";

const rest = new REST().setToken(env.BOT_TOKEN);

const commands = await getCommands();
const globalCommands = [];
const guildCommands = [];

for (const command of commands) {
  const data = command.data.toJSON();
  if (command.isGlobal) globalCommands.push(data);
  else guildCommands.push(data);
}

try {
  console.log(
    `Started refreshing ${commands.length} application (/) commands.`
  );

  const guildResult: any = await rest.put(
    Routes.applicationGuildCommands(env.APPLICATION_ID, env.GUILD_ID),
    {
      body: guildCommands,
    }
  );
  const globalResult: any = await rest.put(
    Routes.applicationCommands(env.APPLICATION_ID),
    {
      body: globalCommands,
    }
  );

  console.log(
    `Successfully reloaded ${
      guildResult.length + globalResult.length
    } application (/) commands.`
  );
} catch (error) {
  console.error(error);
}
