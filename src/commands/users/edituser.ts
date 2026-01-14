import { MessageFlags } from "discord.js";
import type { CommandData } from "../../types/commands.js";
import {
  baseUserCommand,
  canAlterPermissions,
  isFromOwner,
  parsePermissionOptions,
} from "../../utils/users.js";
import { NOT_ENOUGH_CLEARANCE_PUNT_MESSAGE } from "../../utils/constants.js";
import { logger } from "../../logging/logger.js";
import { invalidCharGuard } from "../../utils/middleware.js";

const commandData: CommandData = {
  isGlobal: false,
  permissions: ["editUser"],
  data: baseUserCommand()
    .setName("edituser")
    .setDescription("Edit username or permissions of an existing user"),
  async execute(db, interaction) {
    const isInvalidInput = await invalidCharGuard(interaction);
    if (isInvalidInput) return;

    const targetId = interaction.options.getString("id", true);
    const newPermissions = parsePermissionOptions(interaction, "integer");
    const info = { editorId: interaction.user.id, targetId, newPermissions };

    if (!isFromOwner(interaction)) {
      const editor = await db.getUserPermissionsById(interaction.user.id);

      if (!editor) {
        logger.error(info, "user not found after authorization");
        return interaction.reply({
          content: "Something went wrong while handling command",
          flags: MessageFlags.Ephemeral,
        });
      }

      const oldPermissions = await db.getUserPermissionsById(targetId);

      if (!canAlterPermissions(editor, newPermissions, oldPermissions)) {
        logger.info(
          { editor, ...info },
          "not enough clearance to grant these permissions"
        );
        return interaction.reply({
          content: NOT_ENOUGH_CLEARANCE_PUNT_MESSAGE,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    try {
      const username = interaction.options.getString("username") ?? undefined;

      const updated = await db.updateUserPermissions(targetId, {
        username,
        ...newPermissions,
      });

      if (updated) {
        logger.info({ ...info }, "updated user permissions");
        return interaction.reply({
          content: `Edits to ${updated.username} (${targetId}) have been saved`,
          flags: MessageFlags.Ephemeral,
        });
      }

      logger.debug({ ...info }, "user to edit not found");
      return interaction.reply({
        content: `User with ID ${targetId} not found in database`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error({ error, ...info }, "could not update user permissions");
      return interaction.reply({
        content: "Something went wrong while updating user in database",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default commandData;
