import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { CommandExecutor } from "../../types/commands.js";
import { getStickerById } from "../../db/index.js";
import { getVariantUrl } from "../../utils/index.js";

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

  if (sticker) {
    return interaction.reply(getVariantUrl(id, "high"));
  }
  return interaction.reply({
    content: "No sticker matches the criteria",
    flags: MessageFlags.Ephemeral,
  });
};

export { autocomplete } from "../../utils/index.js";
