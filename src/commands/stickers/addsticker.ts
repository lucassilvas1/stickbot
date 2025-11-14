import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { CommandExecutor } from "../../types/commands.js";
import {
  Constants,
  generateId,
  getVariantInfo,
  getVariantPaths,
  processFile,
  saveFile,
  TypedError,
} from "../../utils/index.js";
import { join } from "path";
import { Dispatcher, request } from "undici";
import { env } from "../../env.js";
import { insertSticker } from "../../db/index.js";
import { rm } from "fs/promises";
import type { TypedErrorCode } from "../../types/misc.js";

export const cooldown = 5_000;

export const data = new SlashCommandBuilder()
  .setName("addsticker")
  .setDescription(
    "Add a new sticker via URL or attachment. Videos will be trimmed to " +
      Constants.MAX_VIDEO_DURATION_SECONDS +
      "s"
  )
  .addStringOption((opt) =>
    opt
      .setName("title")
      .setDescription("Title of the sticker. Should be unique")
      .setRequired(true)
      .setMinLength(8)
      .setMaxLength(64)
  )
  .addStringOption((opt) =>
    opt
      .setName("tags")
      .setDescription(
        "Tags to help find the sticker. Comma separated, supports spaces"
      )
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(256)
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
      .setMaxLength(512)
  );

async function fetchMedia(url: string) {
  const res = await request(url, {
    bodyTimeout: Constants.MEDIA_DOWNLOAD_TIMEOUT_MS,
    headersTimeout: Constants.MEDIA_DOWNLOAD_TIMEOUT_MS,
    method: "GET",
  });

  if (res.statusCode >= 400) {
    throw new TypedError("HTTP", { message: res.statusCode.toString() });
  }

  if (
    Number(res.headers["content-length"]) > Constants.MAX_ATTACHMENT_SIZE_BYTES
  ) {
    await res.body.dump();
    throw new TypedError("TOO_LARGE");
  }

  const [kind, ext] = (res.headers["content-type"] as string)
    .toLowerCase()!
    .split(";")[0]!
    .split("/");

  if (!kind || !ext) {
    throw new TypedError("INVALID_TYPE", {
      message: "Could not infer MIME type from headers",
    });
  }

  if (!["image", "video"].includes(kind!)) {
    await res.body.dump();
    throw new TypedError("INVALID_TYPE", {
      message: res.headers["content-type"]?.toString(),
    });
  }

  return { response: res, extension: ext };
}

async function generateVariants(
  originalPath: string,
  stickerId: string,
  body: Dispatcher.ResponseData<null>["body"]
) {
  const fileName = stickerId + ".webp";
  const highVariantPath = join(
    env.ASSETS_DIR_PATH,
    Constants.VariantEncodingMap.high.dirName,
    fileName
  );
  const thumbnailVariantPath = join(
    env.ASSETS_DIR_PATH,
    Constants.VariantEncodingMap.thumbnail.dirName,
    fileName
  );

  try {
    await saveFile(originalPath, body);

    console.log("Saved original file");

    await Promise.all([
      processFile(
        originalPath,
        highVariantPath,
        Constants.VariantEncodingMap.high
      ),
      processFile(
        originalPath,
        thumbnailVariantPath,
        Constants.VariantEncodingMap.thumbnail
      ),
    ]);

    return Promise.all([
      getVariantInfo(stickerId, "original", originalPath),
      getVariantInfo(stickerId, "high", highVariantPath),
      getVariantInfo(stickerId, "thumbnail", thumbnailVariantPath),
    ]);
  } catch (error) {
    console.error(error);

    await Promise.all([
      rm(originalPath, { force: true }),
      rm(highVariantPath, { force: true }),
      rm(thumbnailVariantPath, { force: true }),
    ]);

    throw new TypedError("PROCESSING_ERROR", { cause: error });
  }
}

export const execute: CommandExecutor = async (interaction) => {
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

  const stickerId = generateId(Constants.STICKER_ID_LENGTH);
  let originalExt = "";

  try {
    const { response, extension: originalExt } = await fetchMedia(url);

    await interaction.editReply({
      content: "Processing sticker. This could take several seconds",
    });

    const originalPath = join(
      env.ASSETS_DIR_PATH,
      Constants.ORIGINAL_MEDIA_DOWNLOAD_DIR_NAME,
      `${stickerId}.${originalExt}`
    );

    const variants = await generateVariants(
      originalPath,
      stickerId,
      response.body
    );

    console.log("Processed files");

    await insertSticker(
      {
        id: stickerId,
        title: interaction.options.getString("title", true),
        description: interaction.options.getString("description"),
        sourceUrl: url,
        uploaderId: interaction.user.id,
        tags: interaction.options.getString("tags", true),
      },
      variants
    );

    await interaction.deleteReply();

    return interaction.followUp({ content: `Filename: ${stickerId}` });
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
      TOO_LARGE: `The provided file is too big. Please try again with a file ${Constants.MAX_ATTACHMENT_SIZE_MB}MB or smaller.`,
      PROCESSING_ERROR:
        "Something went wrong while processing the file. " + retryMessage,
    };

    return interaction.editReply({
      content:
        error instanceof TypedError
          ? errorMessages[error.code] ?? genericMessage
          : genericMessage,
    });
  }
};
