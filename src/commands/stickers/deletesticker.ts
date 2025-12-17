import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import type { CommandData } from "../../types/commands.js";
import { authorizeStickerUploader } from "../../utils/users.js";
import { deleteSticker } from "../../db/dbActions.js";
import { autocomplete } from "../../utils/stickers.js";

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
        return interaction.reply({ content: "Sticker successfully deleted" });
      } else {
        console.error("Something went wrong deleting sticker. ID: ", id);
        return interaction.reply({
          content: "Something went wrong while deleting sticker...",
        });
      }
    } catch (error) {
      console.error(error);
      return interaction.reply({
        content: "Something went wrong while deleting sticker...",
      });
    }
  },
  autocomplete,
};

export default commandData;
