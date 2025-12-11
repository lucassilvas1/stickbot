import { env } from "../env.js";
import type { SimplifiedSticker, StickerVariant } from "../types/stickers.js";
import { join } from "path";
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

export function getVariantPaths(stickerId: string, originalExtension: string) {
  const paths = Object.values(VariantEncodingMap).map(({ dirName }) =>
    join(env.ASSETS_DIR_PATH, dirName, stickerId + ".webp")
  );

  paths.push(
    join(
      env.ASSETS_DIR_PATH,
      ORIGINAL_MEDIA_DOWNLOAD_DIR_NAME,
      `${stickerId}.${originalExtension}`
    )
  );

  return paths;
}
