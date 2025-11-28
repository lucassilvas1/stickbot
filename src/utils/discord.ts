import path from "node:path";
import fs from "node:fs";
import type { CommandData } from "../types/commands.js";
import type { Client } from "discord.js";

export async function getCommands() {
  const foldersPath = path.join(import.meta.dirname, "../../dist/commands");
  const commandFolders = fs.readdirSync(foldersPath);
  const commands: CommandData[] = [];

  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith(".js"));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = await import("file://" + filePath);
      // Set a new item in the Collection with the key as the command name and the value as the exported module
      if ("data" in command && "execute" in command) {
        commands.push(command);
      } else {
        console.log(
          `[WARNING] The command at "${filePath}" is missing a required "data" or "execute" property.`
        );
      }
    }
  }

  return commands;
}

export async function registerEventHandlers(client: Client) {
  const eventsPath = path.join(import.meta.dirname, "../../dist/events");
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const handler = await import("file://" + filePath);

    if (handler.once) {
      client.once(handler.name, (...args) => handler.handle(...args));
    } else {
      client.on(handler.name, (...args) => handler.handle(...args));
    }
  }
}
