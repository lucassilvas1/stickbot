import type {
  CacheType,
  ChatInputCommandInteraction,
  Interaction,
  SlashCommandOptionsOnlyBuilder,
} from "discord.js";
import type { Permissions } from "../types/db.js";
import { USER_PERMISSION_WEIGHT_MAP } from "./constants.js";
import { getStickerById, getUserPermissionsById } from "../db/dbActions.js";

export async function authorizeStickerUploader(
  interaction: Interaction<CacheType>
) {
  if (interaction.isAutocomplete()) {
    // Anyone in the db can get autocomplete suggestions
    const permissions = await getUserPermissionsById(interaction.user.id);
    return !!permissions;
  }
  // autocomplete and command are the only interactions supported
  if (!interaction.isChatInputCommand()) return false;
  const stickerId = interaction.options.getString("query");
  // Shouldn't be necessary, but just to make sure
  if (!stickerId) return false;
  // Uploaders can always manage their own stickers
  return isUploader(interaction.user.id, stickerId);
}

export async function isUploader(userId: string, stickerId: string) {
  const sticker = await getStickerById(stickerId);
  return Boolean(sticker && sticker.uploaderId === userId);
}

export function isFromOwner(interaction: Interaction<CacheType>) {
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
): Partial<IntToBoolProps<Permissions> | Permissions> {
  const grantAll = interaction.options.getBoolean("grant-all") || undefined;

  const permissions: Partial<IntToBoolProps<Permissions>> = {
    addSticker: grantAll,
    editSticker: grantAll,
    deleteSticker: grantAll,
    addUser: grantAll,
    editUser: grantAll,
    deleteUser: grantAll,
  };

  const overridePermissions = {
    addSticker: interaction.options.getBoolean("add-sticker"),
    editSticker: interaction.options.getBoolean("edit-sticker"),
    deleteSticker: interaction.options.getBoolean("delete-sticker"),
    addUser: interaction.options.getBoolean("add-user"),
    editUser: interaction.options.getBoolean("edit-user"),
    deleteUser: interaction.options.getBoolean("delete-user"),
  };

  for (const [key, value] of Object.entries(overridePermissions)) {
    if (value === null) continue;
    permissions[key as keyof Permissions] = value;
  }

  if (type === "integer") {
    return Object.entries(permissions).reduce((result, [key, value]) => {
      if (value !== undefined) result[key as keyof Permissions] = ~~value!;
      return result;
    }, {} as Permissions);
  }
  return permissions;
}

export async function isUserAllowed<P extends keyof Permissions>(
  permission: P,
  interaction: ChatInputCommandInteraction<CacheType>
) {
  if (isFromOwner(interaction)) return true;
  const user = await getUserPermissionsById(interaction.user.id);
  return Boolean(user && user[permission]);
}

export function getUserPermissionWeight(user: Permissions) {
  let highestWeight = 0;
  for (const key of Object.keys(USER_PERMISSION_WEIGHT_MAP)) {
    const permission = key as keyof typeof USER_PERMISSION_WEIGHT_MAP;
    if (!user[permission]) continue;
    const weight = USER_PERMISSION_WEIGHT_MAP[permission];
    if (weight > highestWeight) highestWeight = weight;
  }
  return highestWeight;
}

export function addPermissionOptions(builder: SlashCommandOptionsOnlyBuilder) {
  return builder
    .addBooleanOption((opt) =>
      opt
        .setName("grant-all")
        .setDescription(
          "Grants all permissions to the user. Can be overridden by individual options."
        )
    )
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
