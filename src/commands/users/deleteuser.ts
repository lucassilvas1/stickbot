import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { CommandExecutor } from "../../types/commands.js";
import { deleteUserPermissions } from "../../db/dbActions.js";
import { addPermissionOptions, isUserAllowed } from "../../utils/users.js";
import { PERMISSION_PUNT_MESSAGE } from "../../utils/constants.js";

export const isGlobal = false;

export const data = addPermissionOptions(
  new SlashCommandBuilder()
    .setName("deleteuser")
    .setDescription("Delete a user from the database")
    .addStringOption((opt) =>
      opt
        .setName("id")
        .setDescription("User ID (NOT guild member ID) of the user")
        .setRequired(true)
    )
);

export const execute: CommandExecutor = async (interaction) => {
  const targetId = interaction.options.getString("id", true);

  if (!(await isUserAllowed("deleteUser", interaction))) {
    return interaction.reply({
      content: PERMISSION_PUNT_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
  }

  try {
    const deleted = await deleteUserPermissions(targetId);

    if (deleted) {
      return interaction.reply({
        content: `${targetId} has been deleted from the database`,
        flags: MessageFlags.Ephemeral,
      });
    }
    return interaction.reply({
      content: `${targetId} is not in the database`,
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
