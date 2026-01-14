import {
  SlashCommandBuilder,
  type CacheType,
  type ChatInputCommandInteraction,
  type Interaction,
} from "discord.js";
import { PERMISSIONS, type Permissions } from "../types/db.js";
import { MAX_USERNAME_LENGTH, MIN_USERNAME_LENGTH } from "./constants.js";
import type { BoundDBFunctions } from "../db/dbActions.js";

export async function authorizeStickerUploader(
  db: BoundDBFunctions,
  interaction: Interaction<CacheType>
) {
  if (interaction.isAutocomplete()) {
    // Anyone in the db can get autocomplete suggestions
    const permissions = await db.getUserPermissionsById(interaction.user.id);
    return !!permissions;
  }
  // autocomplete and command are the only interactions supported
  if (!interaction.isChatInputCommand()) return false;
  const stickerId = interaction.options.getString("query");
  // Shouldn't be necessary, but just to make sure
  if (!stickerId) return false;
  // Uploaders can always manage their own stickers
  return isUploader(db, interaction.user.id, stickerId);
}

export async function isUploader(
  db: BoundDBFunctions,
  userId: string,
  stickerId: string
) {
  const sticker = await db.getStickerById(stickerId);
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

export function permissionArrayToObj(array: (keyof Permissions)[]) {
  return PERMISSIONS.reduce((permissions, permission) => {
    const hasPermission = array.includes(permission);
    permissions[permission] = ~~hasPermission;

    return permissions;
  }, {} as Permissions);
}

export function isValidPermissionArray(
  array: readonly string[]
): array is (keyof Permissions)[] {
  return array.every((p) => PERMISSIONS.includes(p as keyof Permissions));
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
  db: BoundDBFunctions,
  permission: P,
  interaction: ChatInputCommandInteraction<CacheType>
) {
  if (isFromOwner(interaction)) return true;
  const user = await db.getUserPermissionsById(interaction.user.id);
  return Boolean(user && user[permission]);
}

export function diffPermissions(New: Permissions, Old?: Permissions) {
  if (!Old) {
    // If there are no old permissions, only return new granted permissions
    return Object.keys(New).filter(
      (p) => New[p as keyof Permissions]
    ) as (keyof Permissions)[];
  }
  // Otherwise return any difference between the two states
  return Object.keys(New).filter(
    (p) => New[p as keyof Permissions] !== Old[p as keyof Permissions]
  ) as (keyof Permissions)[];
}

export function canAlterPermissions(
  editor: Permissions,
  newPermissions: Permissions,
  oldPermissions?: Permissions
) {
  const diff = diffPermissions(newPermissions, oldPermissions);
  return diff.every((p) => editor[p]);
}

export function baseUserCommand(requireUsername = false) {
  return new SlashCommandBuilder()
    .addStringOption((opt) =>
      opt
        .setName("id")
        .setDescription("User ID (NOT guild member ID) of the user")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("username")
        .setDescription(
          "Does not have to match their username on Discord. Only letters, numbers and spaces allowed!"
        )
        .setMinLength(MIN_USERNAME_LENGTH)
        .setMaxLength(MAX_USERNAME_LENGTH)
        .setRequired(requireUsername)
    )
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
