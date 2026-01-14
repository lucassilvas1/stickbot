import path from "node:path";
import fs from "node:fs";
import type { CommandData } from "../types/commands.js";
import type {
  ButtonInteraction,
  Client,
  CommandInteraction,
  InteractionReplyOptions,
  ModalSubmitInteraction,
} from "discord.js";
import { logger } from "../logging/logger.js";
import type { BoundDBFunctions } from "../db/dbActions.js";

export function safeReply(
  interaction: CommandInteraction | ModalSubmitInteraction | ButtonInteraction,
  replyOptions: InteractionReplyOptions
) {
  if (Date.now() - interaction.createdTimestamp >= 15 * 60 * 1000) {
    logger.warn(
      { interaction, replyOptions },
      "interaction is too old to reply to"
    );
    return;
  }

  const method =
    interaction.replied || interaction.deferred ? "followUp" : "reply";
  return interaction[method](replyOptions);
}

export async function getCommands(
  commandsDirPath = path.join(import.meta.dirname, "../commands")
) {
  const commandFolders = fs.readdirSync(commandsDirPath);
  const commands: CommandData[] = [];
  const requiredFields = ["data", "execute", "permissions"];

  for (const folder of commandFolders) {
    const commandsPath = path.join(commandsDirPath, folder);
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith(".js"));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const { default: command } = await import("file://" + filePath);
      // Set a new item in the Collection with the key as the command name and the value as the exported module
      if (requiredFields.every((f) => f in command)) {
        commands.push(command);
      } else {
        logger.error(
          { filePath, command },
          "command missing one or more required fields"
        );
      }
    }
  }

  return commands;
}

export async function registerEventHandlers(
  client: Client,
  db: BoundDBFunctions,
  eventsDirPath = path.join(import.meta.dirname, "../events")
) {
  const eventFiles = fs
    .readdirSync(eventsDirPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of eventFiles) {
    const filePath = path.join(eventsDirPath, file);
    const handler = await import("file://" + filePath);

    if (handler.once) {
      client.once(handler.name, (...args) => handler.handle(db, ...args));
    } else {
      client.on(handler.name, (...args) => handler.handle(db, ...args));
    }
  }
}
