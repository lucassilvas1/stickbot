import {
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { CommandData } from "../../types/commands.js";
import { join } from "path";
import { env } from "../../env.js";
import { rm } from "fs/promises";
import {
  MAX_ATTACHMENT_SIZE_MB,
  MAX_DESCRIPTION_LENGTH,
  MAX_TAGS_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_VIDEO_DURATION_SECONDS,
  MIN_TAGS_LENGTH,
  MIN_TITLE_LENGTH,
  ORIGINAL_MEDIA_DOWNLOAD_DIR_NAME,
  STICKER_ID_LENGTH,
} from "../../utils/constants.js";
import { generateId } from "../../utils/misc.js";
import { generateVariants, fetchMedia } from "../../utils/processing.js";
import { getVariantPaths, getVariantUrl } from "../../utils/stickers.js";
import { invalidCharGuard } from "../../utils/middleware.js";
import { logger } from "../../logging/logger.js";
import { TypedError, type TypedErrorCode } from "../../utils/error.js";

const commandData: CommandData = {
  isGlobal: true,
  cooldown: 5_000,
  permissions: ["addSticker"],
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
    .setName("addsticker")
    .setDescription(
      "Add a new sticker via URL or attachment. Videos will be trimmed to " +
        MAX_VIDEO_DURATION_SECONDS +
        "s"
    )
    .addStringOption((opt) =>
      opt
        .setName("title")
        .setDescription("Title of the sticker. Should be unique")
        .setRequired(true)
        .setMinLength(MIN_TITLE_LENGTH)
        .setMaxLength(MAX_TITLE_LENGTH)
    )
    .addStringOption((opt) =>
      opt
        .setName("tags")
        .setDescription("Space-separated tags to help find the sticker.")
        .setRequired(true)
        .setMinLength(MIN_TAGS_LENGTH)
        .setMaxLength(MAX_TAGS_LENGTH)
    )
    .addAttachmentOption((opt) =>
      opt
        .setName("file")
        .setDescription("Media file attachment to use as sticker")
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("url")
        .setDescription(
          "Direct URL of the image/GIF to use as sticker. Required unless using attachment"
        )
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("description")
        .setDescription(
          "Long form description of the sticker. Not currently used"
        )
        .setRequired(false)
        .setMaxLength(MAX_DESCRIPTION_LENGTH)
    ),
  async execute(db, interaction) {
    const isInvalidInput = await invalidCharGuard(interaction);
    if (isInvalidInput) return;

    const url =
      interaction.options.getString("url") ??
      interaction.options.getAttachment("file")?.url;

    if (!url) {
      return interaction.reply({
        content: "You must provide either a URL or an attachment!",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const stickerId = generateId(STICKER_ID_LENGTH);
    let originalExt = "";

    try {
      const { response, extension: originalExt } = await fetchMedia(url);

      await interaction.editReply({
        content: "Processing sticker. This could take several seconds",
      });

      const originalPath = join(
        env.ASSETS_DIR_PATH,
        ORIGINAL_MEDIA_DOWNLOAD_DIR_NAME,
        `${stickerId}.${originalExt}`
      );

      const variants = await generateVariants(
        originalPath,
        stickerId,
        response.body
      );

      logger.debug(
        { interaction: interaction.id, stickerId },
        "processed files"
      );

      const stickerData = {
        id: stickerId,
        title: interaction.options.getString("title", true),
        description: interaction.options.getString("description"),
        sourceUrl: url,
        uploaderId: interaction.user.id,
        tags: interaction.options.getString("tags", true),
      };
      await db.insertSticker(stickerData, variants);

      await interaction.deleteReply();

      logger.info(stickerData, "added sticker");

      return interaction.followUp(getVariantUrl(stickerId, "high"));
    } catch (error) {
      console.error(error);

      await Promise.all(
        getVariantPaths(stickerId, originalExt).map((path) =>
          rm(path, { force: true })
        )
      );

      const retryMessage = "Please try again later";
      const genericMessage = "Something went wrong...";

      const errorMessages: Partial<Record<TypedErrorCode, string>> = {
        HTTP:
          "Something went wrong while downloading source file. " + retryMessage,
        INVALID_TYPE:
          "The provided file is not supported. Please try a different one",
        TOO_LARGE: `The provided file is too big. Please try again with a file ${MAX_ATTACHMENT_SIZE_MB}MB or smaller.`,
        PROCESSING_ERROR:
          "Something went wrong while processing the file. " + retryMessage,
      };

      logger.error(error, "could not add sticker");

      return interaction.editReply({
        content:
          error instanceof TypedError
            ? errorMessages[error.code] ?? genericMessage
            : genericMessage,
      });
    }
  },
};

export default commandData;
