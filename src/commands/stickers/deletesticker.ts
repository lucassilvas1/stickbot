import {
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { CommandData } from "../../types/commands.js";
import { authorizeStickerUploader } from "../../utils/users.js";
import { deleteSticker } from "../../db/dbActions.js";
import { autocomplete } from "../../utils/stickers.js";
import { logger } from "../../logging/logger.js";

const commandData: CommandData = {
  isGlobal: true,
  overridePermissions: authorizeStickerUploader,
  permissions: ["deleteSticker"],
  data: new SlashCommandBuilder()
    .setContexts([
      InteractionContextType.PrivateChannel,
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
    ])
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall,
    ])
    .setName("deletesticker")
    .setDescription("Delete a sticker by title")
    .addStringOption((opt) =>
      opt
        .setName("query")
        .setDescription("Describe the sticker to get suggestions")
        .setRequired(true)
        .setAutocomplete(true)
    ),
  async execute(interaction) {
    const id = interaction.options.getString("query", true);

    try {
      const isDeleted = await deleteSticker(id);
      if (isDeleted) {
        logger.info(
          { sticker: id, user: interaction.user.id },
          "deleted sticker"
        );
        return interaction.reply({
          content: "Sticker deleted",
          flags: MessageFlags.Ephemeral,
        });
      } else {
        logger.error(
          { sticker: id, user: interaction.user.id },
          "could not delete sticker"
        );
        return interaction.reply({
          content: "Could not find sticker to delete",
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (error) {
      logger.error(
        { error, sticker: id, user: interaction.user.id },
        "could not delete sticker"
      );
      return interaction.reply({
        content: "Something went wrong while deleting sticker...",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
  autocomplete,
};

export default commandData;
