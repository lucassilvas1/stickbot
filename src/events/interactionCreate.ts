import {
  Events,
  MessageFlags,
  type CacheType,
  type Interaction,
} from "discord.js";
import { authorization, rateLimit } from "../utils/middleware.js";
import { PERMISSION_PUNT_MESSAGE } from "../utils/constants.js";
import { logger } from "../logger.js";

export const name = Events.InteractionCreate;

export const once = false;

function getCommand(
  interaction: Interaction<CacheType> & { commandName: string }
) {
  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    logger.error({ command: interaction.commandName }, "command not found");
    return;
  }

  return command;
}

function respondUnauthorized(interaction: Interaction<CacheType>) {
  if (interaction.isAutocomplete()) {
    return interaction.respond([]);
  } else if (interaction.isChatInputCommand()) {
    return interaction.reply({
      content: PERMISSION_PUNT_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
  }
}

export async function handle(interaction: Interaction<CacheType>) {
  if (!interaction.isAutocomplete() && !interaction.isChatInputCommand()) {
    return;
  }

  const command = getCommand(interaction);
  // Unregistered command
  if (!command) return;

  const info = {
    user: interaction.user.id,
    command: interaction.commandName,
    options: interaction.options.data,
  };
  const authorized = await authorization(command, interaction);
  if (!authorized) {
    logger.debug(info, "booted unauthorized user");
    await respondUnauthorized(interaction);
    return;
  }

  if (interaction.isChatInputCommand()) {
    if (await rateLimit(command, interaction)) return;

    try {
      await command.execute(interaction);
      logger.debug(
        {
          command: interaction.commandName,
          options: interaction.options.data,
          user: interaction.user.id,
        },
        "command handled"
      );
    } catch (error) {
      logger.error({ error, ...info }, "command handler threw");
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
    try {
      await command.autocomplete!(interaction);
    } catch (error) {
      logger.error({ error, ...info }, "autocomplete handler threw");
    }
  }
}
