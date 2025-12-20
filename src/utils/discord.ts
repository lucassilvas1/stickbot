import path from "node:path";
import fs from "node:fs";
import type { CommandData } from "../types/commands.js";
import type { Client } from "discord.js";
import { logger } from "../logger.js";

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
        logger.warn(
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
  eventsDirPath = path.join(import.meta.dirname, "../events")
) {
  const eventFiles = fs
    .readdirSync(eventsDirPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of eventFiles) {
    const filePath = path.join(eventsDirPath, file);
    const handler = await import("file://" + filePath);

    if (handler.once) {
      client.once(handler.name, (...args) => handler.handle(...args));
    } else {
      client.on(handler.name, (...args) => handler.handle(...args));
    }
  }
}
