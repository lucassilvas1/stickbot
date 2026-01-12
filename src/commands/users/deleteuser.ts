import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { CommandData } from "../../types/commands.js";
import { deleteUserPermissions } from "../../db/dbActions.js";
import { logger } from "../../logging/logger.js";

const commandData: CommandData = {
  isGlobal: false,
  permissions: ["deleteUser"],
  data: new SlashCommandBuilder()
    .setName("deleteuser")
    .setDescription("Delete a user from the database")
    .addStringOption((opt) =>
      opt
        .setName("id")
        .setDescription("User ID (NOT guild member ID) of the user")
        .setRequired(true)
    ),
  async execute(interaction) {
    const targetId = interaction.options.getString("id", true);
    const info = { targetId, userId: interaction.user.id };

    try {
      const user = await deleteUserPermissions(targetId);

      if (user) {
        logger.info(info, "deleted user");
        return interaction.reply({
          content: `${user.username} (${targetId}) has been deleted`,
          flags: MessageFlags.Ephemeral,
        });
      }
      logger.info(info, "user not in db");
      return interaction.reply({
        content: `User with ID ${targetId} could not be found`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error({ error, ...info }, "could not delete user");
      return interaction.reply({
        content: "Something went wrong while updating user in database",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default commandData;
