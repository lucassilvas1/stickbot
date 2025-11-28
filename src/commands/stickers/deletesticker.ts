import {
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { CommandExecutor } from "../../types/commands.js";
import { isUploader, isUserAllowed } from "../../utils/users.js";
import { deleteSticker } from "../../db/dbActions.js";
import { PERMISSION_PUNT_MESSAGE } from "../../utils/constants.js";

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
  .setName("deletesticker")
  .setDescription("Delete a sticker by title")
  .addStringOption((opt) =>
    opt
      .setName("query")
      .setDescription("Describe the sticker to get suggestions")
      .setRequired(true)
      .setAutocomplete(true)
  );

export const execute: CommandExecutor = async (interaction) => {
  const id = interaction.options.getString("query", true);

  if (
    !(await isUserAllowed("deleteSticker", interaction)) &&
    !(await isUploader(interaction.user.id, id))
  ) {
    return interaction.reply({
      content: PERMISSION_PUNT_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
  }

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
};

export { autocomplete } from "../../utils/stickers.js";
