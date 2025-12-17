import {
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { CommandData } from "../../types/commands.js";
import { getStickerById } from "../../db/dbActions.js";
import { getVariantUrl } from "../../utils/stickers.js";
import { autocomplete } from "../../utils/stickers.js";

const commandData: CommandData = {
  isGlobal: true,
  permissions: [],
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
    .setName("sticker")
    .setDescription("Choose a sticker by title")
    .addStringOption((opt) =>
      opt
        .setName("query")
        .setDescription("Describe the sticker to get suggestions")
        .setRequired(true)
        .setAutocomplete(true)
    ),
  async execute(interaction) {
    const id = interaction.options.getString("query", true);
    const sticker = await getStickerById(id, true, interaction.user.id);

    if (sticker) {
      return interaction.reply(getVariantUrl(id, "high"));
    }
    return interaction.reply({
      content: "No sticker matches the criteria",
      flags: MessageFlags.Ephemeral,
    });
  },
  autocomplete,
};

export default commandData;
