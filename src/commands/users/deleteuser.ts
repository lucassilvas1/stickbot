import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { CommandData } from "../../types/commands.js";
import { deleteUserPermissions } from "../../db/dbActions.js";
import { addPermissionOptions } from "../../utils/users.js";

const commandData: CommandData = {
  isGlobal: false,
  permissions: ["deleteUser"],
  data: addPermissionOptions(
    new SlashCommandBuilder()
      .setName("deleteuser")
      .setDescription("Delete a user from the database")
      .addStringOption((opt) =>
        opt
          .setName("id")
          .setDescription("User ID (NOT guild member ID) of the user")
          .setRequired(true)
      )
  ),
  async execute(interaction) {
    const targetId = interaction.options.getString("id", true);

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
  },
};

export default commandData;
