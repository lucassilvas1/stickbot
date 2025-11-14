import { SlashCommandBuilder } from "discord.js";
import type {
  CommandAutocomplete,
  CommandExecutor,
} from "../../types/commands.js";
import { getStickerById, search } from "../../db/index.js";

export const data = new SlashCommandBuilder()
  .setName("sticker")
  .setDescription("Choose a sticker by title")
  .addStringOption((opt) =>
    opt
      .setName("query")
      .setDescription("Describe the sticker to get suggestions")
      .setRequired(true)
      .setAutocomplete(true)
  );

export const execute: CommandExecutor = async (interaction) => {
  const id = interaction.options.getString("query", true);
  const sticker = await getStickerById(id);

  return interaction.reply(JSON.stringify(sticker));
};

export const autocomplete: CommandAutocomplete = async (interaction) => {
  const query = interaction.options.getString("query", true);

  if (query.length < 3) return interaction.respond([]);

  console.log(Array.from(interaction.options.data.entries()));

  const suggestions = await search(query);
  console.log(suggestions);

  return interaction.respond(suggestions);
};
