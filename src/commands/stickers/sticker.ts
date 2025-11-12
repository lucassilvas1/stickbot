import { SlashCommandBuilder } from "discord.js";
import type {
  CommandAutocomplete,
  CommandExecutor,
} from "../../types/commands.js";

export const data = new SlashCommandBuilder()
  .setName("sticker")
  .setDescription("Choose a sticker by title")
  .addStringOption((opt) =>
    opt
      .setName("title")
      .setDescription("Title of the sticker")
      .setRequired(true)
      .setAutocomplete(true)
  );

export const execute: CommandExecutor = async (interaction) => {
  return interaction.reply("Not implemented");
};

export const autocomplete: CommandAutocomplete = async (interaction) => {
  return interaction.respond([
    { name: "Not implemented", value: "not_implemented" },
    { name: "Yet", value: "yet" },
  ]);
};
