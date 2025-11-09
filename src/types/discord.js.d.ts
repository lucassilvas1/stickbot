import type { Collection, SlashCommandBuilder } from "discord.js";
import type { CommandData, CooldownCollection } from "./commands.ts";

declare module "discord.js" {
  export interface Client {
    commands: Collection<string, CommandData>;
    cooldowns: CooldownCollection;
  }
}
