import {
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { CommandExecutor } from "../../types/commands.js";
import { deleteSticker } from "../../db/index.js";
import { isUserAllowed } from "../../utils/users.js";
import { Constants } from "../../utils/index.js";

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
  if (!(await isUserAllowed("deleteSticker", interaction))) {
    return interaction.reply({
      content: Constants.PERMISSION_PUNT_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
  }

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
};

export { autocomplete } from "../../utils/index.js";
