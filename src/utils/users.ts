import type {
  AutocompleteInteraction,
  CacheType,
  ChatInputCommandInteraction,
  SlashCommandOptionsOnlyBuilder,
} from "discord.js";
import type { Permissions } from "../types/db.js";
import { getStickerById, getUserPermissionsById } from "../db/index.js";
import { Constants } from "./index.js";

export async function isUploader(userId: string, stickerId: string) {
  const sticker = await getStickerById(stickerId);
  return Boolean(sticker && sticker.uploaderId === userId);
}

export function isFromOwner(
  interaction:
    | ChatInputCommandInteraction<CacheType>
    | AutocompleteInteraction<CacheType>
) {
  if (!interaction.user.id) return false; // Just to be safe
  const owner = interaction.client.application.owner;
  if (!owner) return false;
  // Team owned
  if ("ownerId" in owner) {
    return owner.ownerId === interaction.user.id;
  }
  // User owned
  return owner.id === interaction.user.id;
}

type IntToBoolProps<T> = {
  [K in keyof T]: T[K] extends number ? boolean : T[K];
};

export function parsePermissionOptions(
  interaction: ChatInputCommandInteraction<CacheType>,
  type: "boolean"
): IntToBoolProps<Permissions>;
export function parsePermissionOptions(
  interaction: ChatInputCommandInteraction<CacheType>,
  type: "integer"
): Permissions;
export function parsePermissionOptions(
  interaction: ChatInputCommandInteraction<CacheType>,
  type: "boolean" | "integer"
): IntToBoolProps<Permissions> | Permissions {
  const permissions = {
    addSticker: !!interaction.options.getBoolean("add-sticker"),
    editSticker: !!interaction.options.getBoolean("edit-sticker"),
    deleteSticker: !!interaction.options.getBoolean("delete-sticker"),
    addUser: !!interaction.options.getBoolean("add-user"),
    editUser: !!interaction.options.getBoolean("edit-user"),
    deleteUser: !!interaction.options.getBoolean("delete-user"),
  };
  if (type === "integer") {
    return Object.entries(permissions).reduce((result, [key, value]) => {
      result[key as keyof Permissions] = ~~value!;
      return result;
    }, {} as Permissions);
  }
  return permissions;
}

export async function isFromAppUser(
  interaction:
    | ChatInputCommandInteraction<CacheType>
    | AutocompleteInteraction<CacheType>
) {
  return (
    isFromOwner(interaction) ||
    !!(await getUserPermissionsById(interaction.user.id))
  );
}

export async function isUserAllowed<P extends keyof Permissions>(
  permission: P,
  interaction: ChatInputCommandInteraction<CacheType>
) {
  if (isFromOwner(interaction)) return true;
  const user = await getUserPermissionsById(interaction.user.id);
  return !!user && !!user[permission];
}

export function getUserPermissionWeight(user: Permissions) {
  let highestWeight = 0;
  for (const key of Object.keys(Constants.USER_PERMISSION_WEIGHT_MAP)) {
    const permission = key as keyof typeof Constants.USER_PERMISSION_WEIGHT_MAP;
    if (!user[permission]) continue;
    const weight = Constants.USER_PERMISSION_WEIGHT_MAP[permission];
    if (weight > highestWeight) highestWeight = weight;
  }
  return highestWeight;
}

export function addPermissionOptions(builder: SlashCommandOptionsOnlyBuilder) {
  return builder
    .addBooleanOption((opt) =>
      opt
        .setName("add-sticker")
        .setDescription("Whether user should be able to add new stickers")
    )
    .addBooleanOption((opt) =>
      opt
        .setName("edit-sticker")
        .setDescription("Whether user should be able to edit existing stickers")
    )
    .addBooleanOption((opt) =>
      opt
        .setName("delete-sticker")
        .setDescription(
          "Whether user should be able to delete users from the database"
        )
    )
    .addBooleanOption((opt) =>
      opt
        .setName("add-user")
        .setDescription(
          "Whether user should be able to add new users to the database"
        )
    )
    .addBooleanOption((opt) =>
      opt
        .setName("edit-user")
        .setDescription("Whether user should be able to edit existing users")
    )
    .addBooleanOption((opt) =>
      opt
        .setName("delete-user")
        .setDescription(
          "Whether user should be able to delete users from the database"
        )
    );
}
