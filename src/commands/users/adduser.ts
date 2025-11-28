import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { CommandExecutor } from "../../types/commands.js";
import { insertUserPermissions } from "../../db/dbActions.js";
import {
  addPermissionOptions,
  isUserAllowed,
  parsePermissionOptions,
} from "../../utils/users.js";
import { PERMISSION_PUNT_MESSAGE } from "../../utils/constants.js";

export const isGlobal = false;

export const data = addPermissionOptions(
  new SlashCommandBuilder()
    .setName("adduser")
    .setDescription(
      "Add a new user to database. All permissions default to false"
    )
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
        .setRequired(true)
    )
);

export const execute: CommandExecutor = async (interaction) => {
  const targetId = interaction.options.getString("id", true);

  if (!(await isUserAllowed("addUser", interaction))) {
    return interaction.reply({
      content: PERMISSION_PUNT_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
  }

  const username = interaction.options.getString("username", true);

  try {
    const inserted = await insertUserPermissions({
      id: targetId,
      username,
      ...parsePermissionOptions(interaction, "integer"),
    });

    if (inserted) {
      return interaction.reply({
        content: `User ${username} (${targetId}) has been successfully added to the database`,
        flags: MessageFlags.Ephemeral,
      });
    }
    return interaction.reply({
      content: "User is already present in the database. No changes were made",
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error(error);
    return interaction.reply({
      content: "Something went wrong while inserting user in database",
      flags: MessageFlags.Ephemeral,
    });
  }
};
