import {
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { CommandExecutor } from "../../types/commands.js";
import { getStickerById, getUserPermissionsById } from "../../db/index.js";
import { Constants, getVariantUrl, isFromOwner } from "../../utils/index.js";

export const isGlobal = true;

export const data = new SlashCommandBuilder()
  .setContexts([
    InteractionContextType.PrivateChannel,
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
  ])
  .setIntegrationTypes([
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall,
  ])
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
  if (
    !isFromOwner(interaction) &&
    !(await getUserPermissionsById(interaction.user.id))
  ) {
    return interaction.reply({
      content: Constants.PERMISSION_PUNT_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
  }

  const id = interaction.options.getString("query", true);
  const sticker = await getStickerById(id, true, interaction.user.id);

  if (sticker) {
    return interaction.reply(getVariantUrl(id, "high"));
  }
  return interaction.reply({
    content: "No sticker matches the criteria",
    flags: MessageFlags.Ephemeral,
  });
};

export { autocomplete } from "../../utils/index.js";
