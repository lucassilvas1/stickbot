import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { CommandExecutor } from "../../types/commands.js";
import {
  getUserPermissionsById,
  updatedUserPermissions,
} from "../../db/dbActions.js";
import {
  addPermissionOptions,
  getUserPermissionWeight,
  isFromOwner,
  isUserAllowed,
  parsePermissionOptions,
} from "../../utils/users.js";
import {
  NOT_ENOUGH_CLEARANCE_PUNT_MESSAGE,
  PERMISSION_PUNT_MESSAGE,
} from "../../utils/constants.js";

export const isGlobal = false;

export const data = addPermissionOptions(
  new SlashCommandBuilder()
    .setName("edituser")
    .setDescription("Edit username or permissions of an existing user")
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
          "A nickname to make it easier to identify the user later. Does not have to match Discord username."
        )
    )
);

export const execute: CommandExecutor = async (interaction) => {
  const targetId = interaction.options.getString("id", true);
  const targetPermissions = parsePermissionOptions(interaction, "integer");

  if (!(await isUserAllowed("editUser", interaction))) {
    return interaction.reply({
      content: PERMISSION_PUNT_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
  }
  if (!isFromOwner(interaction)) {
    const editor = await getUserPermissionsById(interaction.user.id);

    if (!editor) {
      console.log("User not in database after passing check");
      return interaction.reply({
        content: "Something went wrong while handling command",
        flags: MessageFlags.Ephemeral,
      });
    }

    const editorPermissionWeight = getUserPermissionWeight(editor);
    const targetPermissionWeight = getUserPermissionWeight(targetPermissions);

    if (targetPermissionWeight > editorPermissionWeight) {
      return interaction.reply({
        content: NOT_ENOUGH_CLEARANCE_PUNT_MESSAGE,
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  try {
    const username = interaction.options.getString("username") ?? undefined;

    await updatedUserPermissions(targetId, {
      username,
      ...targetPermissions,
    });
    return interaction.reply({
      content: `Edits to ${username} (${targetId}) have been successfully saved`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error(error);
    return interaction.reply({
      content: "Something went wrong while updating user in database",
      flags: MessageFlags.Ephemeral,
    });
  }
};
