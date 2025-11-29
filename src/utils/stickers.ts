import { statSync } from "fs";
import { env } from "../env.js";
import type { SimplifiedSticker, StickerVariant } from "../types/stickers.js";
import { extname, join } from "path";
import type { NewVariant } from "../types/db.js";
import { spawn, TypedError } from "./misc.js";
import type { CommandAutocomplete } from "../types/commands.js";
import { isFromAppUser } from "./users.js";
import {
  ORIGINAL_MEDIA_DOWNLOAD_DIR_NAME,
  VariantEncodingMap,
} from "./constants.js";
import { search } from "../db/dbActions.js";

export function toAutocompleteType(stickers: SimplifiedSticker[]) {
  return stickers.map((s) => ({ name: s.title, value: s.id }));
}

export const autocomplete: CommandAutocomplete = async (interaction) => {
  if (!(await isFromAppUser(interaction))) {
    return interaction.respond([]);
  }

  const query = interaction.options.getString("query", true);
  if (query.length < 3) return interaction.respond([]);
  const { stickers } = await search({ query });
  return interaction.respond(toAutocompleteType(stickers));
};

export function getAssetUrl(relativePath: string) {
  let hostName = env.ASSETS_SERVER_HOSTNAME;
  if (hostName.at(-1) !== "/") hostName += "/";
  if (relativePath[0] === "/") relativePath = relativePath.slice(1);
  return hostName + relativePath;
}

export function getVariantUrl(
  id: string,
  variant: Exclude<StickerVariant, "original">
) {
  return getAssetUrl(`${VariantEncodingMap[variant].dirName}/${id}.webp`);
}

export async function getVariantInfo(
  stickerId: string,
  type: StickerVariant,
  filePath: string
): Promise<NewVariant> {
  // Get file size using fs.statSync
  let fileSizeBytes: number;
  try {
    fileSizeBytes = statSync(filePath).size;
  } catch (error) {
    throw new TypedError("FFPROBE_ERROR", { cause: error });
  }

  // Get extension
  const extension = extname(filePath).substring(1); // Remove leading dot

  // Use ffprobe to get video/image dimensions and frame count
  try {
    const output = await spawn(env.FFPROBE_PATH, [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,nb_read_frames",
      "-count_frames",
      "-of",
      "csv=p=0",
      filePath,
    ]);

    const parts = output.trim().split(",").map(Number);
    const width = parts[0];
    const height = parts[1];
    const frameCount = parts[2];
    if (
      parts.length < 2 ||
      width === undefined ||
      height === undefined ||
      isNaN(width) ||
      isNaN(height)
    ) {
      throw new TypedError("FFPROBE_ERROR", {
        message: "Could not extract width and height from media file",
      });
    } else {
      return {
        stickerId,
        type,
        width,
        height,
        fileSizeBytes,
        extension,
        animated: ~~(frameCount !== undefined && frameCount > 1),
      };
    }
  } catch (error) {
    if (error instanceof TypedError) throw error;
    throw new TypedError("FFPROBE_ERROR", {
      cause: error,
    });
  }
}

export function getVariantPaths(stickerId: string, originalExtension: string) {
  const paths = Object.values(VariantEncodingMap).map(({ dirName }) =>
    join(env.ASSETS_DIR_PATH, dirName, stickerId + ".webp")
  );

  if (originalExtension) {
    paths.push(
      join(
        env.ASSETS_DIR_PATH,
        ORIGINAL_MEDIA_DOWNLOAD_DIR_NAME,
        `${stickerId}.${originalExtension}`
      )
    );
  }

  return paths;
}
