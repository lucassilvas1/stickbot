import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { CommandData } from "../../types/commands.js";
import { insertUserPermissions } from "../../db/dbActions.js";
import {
  addPermissionOptions,
  parsePermissionOptions,
} from "../../utils/users.js";
import { logger } from "../../logger.js";

const commandData: CommandData = {
  isGlobal: false,
  permissions: ["addUser"],
  data: addPermissionOptions(
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
  ),
  async execute(interaction) {
    const targetId = interaction.options.getString("id", true);
    const username = interaction.options.getString("username", true);
    const info = { targetId, userId: interaction.user.id };

    try {
      const inserted = await insertUserPermissions({
        id: targetId,
        username,
        ...parsePermissionOptions(interaction, "integer"),
      });
      if (inserted) {
        logger.info(info, "added user");
        return interaction.reply({
          content: `User ${username} (${targetId}) has been successfully added to the database`,
          flags: MessageFlags.Ephemeral,
        });
      }
      logger.info(info, "user already in db");
      return interaction.reply({
        content:
          "User is already present in the database. No changes were made",
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error({ error, ...info }, "could not add user");
      return interaction.reply({
        content: "Something went wrong while inserting user in database",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default commandData;
