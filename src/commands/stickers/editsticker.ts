import {
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { CommandData } from "../../types/commands.js";
import type { SimplifiedSticker } from "../../types/stickers.js";
import { getStickerById, search, updateSticker } from "../../db/dbActions.js";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_TAGS_LENGTH,
  MAX_TITLE_LENGTH,
  MIN_TAGS_LENGTH,
  MIN_TITLE_LENGTH,
} from "../../utils/constants.js";
import { authorizeStickerUploader } from "../../utils/users.js";
import { toAutocompleteType } from "../../utils/stickers.js";
import { invalidCharGuard } from "../../utils/middleware.js";
import { logger } from "../../logger.js";
import { env } from "../../env.js";

const commandData: CommandData = {
  isGlobal: true,
  overridePermissions: authorizeStickerUploader,
  permissions: ["editSticker"],
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
    .setName("editsticker")
    .setDescription("Edit a sticker by title")
    .addStringOption((opt) =>
      opt
        .setName("query")
        .setDescription("Describe the sticker to get suggestions")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("title")
        .setDescription("Update sticker's title or leave it as it is")
        .setMinLength(MIN_TITLE_LENGTH)
        .setMaxLength(MAX_TITLE_LENGTH)
        .setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("tags")
        .setDescription("Update sticker's tags or leave them as they are")
        .setMinLength(MIN_TAGS_LENGTH)
        .setMaxLength(MAX_TAGS_LENGTH)
        .setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("description")
        .setDescription(
          "Update sticker's description or leave it as it is (currently unused)"
        )
        .setMaxLength(MAX_DESCRIPTION_LENGTH)
    ),
  async execute(interaction) {
    const isInvalidInput = await invalidCharGuard(interaction);
    if (isInvalidInput) return;

    const id = interaction.options.getString("query", true);
    const title = interaction.options.getString("title") ?? undefined;
    const tags = interaction.options.getString("tags") ?? undefined;
    const description =
      interaction.options.getString("description") ?? undefined;

    try {
      await updateSticker(id, { title, tags, description });
      logger.info({ id, title, tags, description }, "updated sticker");
      return interaction.reply({
        content: "Changes have been saved",
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error(
        { error, id, title, tags, description },
        "could not update sticker"
      );
      return interaction.reply({
        content: "Something went wrong while saving changes...",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
  async autocomplete(interaction) {
    const prop = interaction.options.getFocused(true);
    if (prop.name === "query") {
      const { stickers } = await search({
        isAutocomplete: true,
        userId: interaction.user.id,
        query: prop.value,
        order: env.AUTOCOMPLETE_ORDER_BY,
      });
      return interaction.respond(toAutocompleteType(stickers));
    }
    const id = interaction.options.getString("query", true);
    const sticker = await getStickerById(id);
    if (!sticker) {
      logger.debug({ id }, "could not find sticker");
      return interaction.respond([
        {
          name: "STICKER NOT FOUND! PICK A VALID STICKER FROM THE query SUGGESTION FIRST",
          value:
            "STICKER NOT FOUND! PICK A VALID STICKER FROM THE query SUGGESTION FIRST",
        },
      ]);
    }

    // value can only be string because the only columns you can edit are text
    // (title, tags, description)
    const value = sticker[prop.name as keyof SimplifiedSticker] as string;
    return interaction.respond([{ name: value, value }]);
  },
};

export default commandData;
