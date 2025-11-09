import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Events,
  MessageFlags,
  type CacheType,
  type Interaction,
} from "discord.js";
import { rateLimit } from "../utils/index.js";

export const name = Events.InteractionCreate;

export const once = false;

function getCommand(
  interaction: ChatInputCommandInteraction | AutocompleteInteraction
) {
  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(
      `No command matching "${interaction.commandName}" was found.`
    );
    return;
  }

  return command;
}

export async function handle(interaction: Interaction<CacheType>) {
  if (interaction.isChatInputCommand()) {
    const command = getCommand(interaction);
    if (!command) return;

    if (rateLimit(command, interaction)) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "Something went wrong while executing this command!",
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: "Something went wrong while executing this command!",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  } else if (interaction.isAutocomplete()) {
    const command = getCommand(interaction);
    if (!command) return;

    try {
      await command.autocomplete!(interaction);
    } catch (error) {
      console.error({ error, command });
    }
  }
}
