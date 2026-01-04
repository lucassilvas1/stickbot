import { MessageFlags } from "discord.js";
import type { CommandData } from "../../types/commands.js";
import {
  getUserPermissionsById,
  updatedUserPermissions,
} from "../../db/dbActions.js";
import {
  baseUserCommand,
  getUserPermissionWeight,
  isFromOwner,
  parsePermissionOptions,
} from "../../utils/users.js";
import { NOT_ENOUGH_CLEARANCE_PUNT_MESSAGE } from "../../utils/constants.js";
import { logger } from "../../logger.js";
import { invalidCharGuard } from "../../utils/middleware.js";

const commandData: CommandData = {
  isGlobal: false,
  permissions: ["editUser"],
  data: baseUserCommand()
    .setName("edituser")
    .setDescription("Edit username or permissions of an existing user"),
  async execute(interaction) {
    const isInvalidInput = await invalidCharGuard(interaction);
    if (isInvalidInput) return;

    const targetId = interaction.options.getString("id", true);
    const targetPermissions = parsePermissionOptions(interaction, "integer");
    const info = { editorId: interaction.user.id, targetId, targetPermissions };

    if (!isFromOwner(interaction)) {
      const editor = await getUserPermissionsById(interaction.user.id);

      if (!editor) {
        logger.error(info, "user not found after authorization");
        return interaction.reply({
          content: "Something went wrong while handling command",
          flags: MessageFlags.Ephemeral,
        });
      }

      const editorPermissionWeight = getUserPermissionWeight(editor);
      const targetPermissionWeight = getUserPermissionWeight(targetPermissions);

      if (targetPermissionWeight > editorPermissionWeight) {
        logger.info(
          { targetPermissionWeight, editorPermissionWeight, ...info },
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

      const updated = await updatedUserPermissions(targetId, {
        username,
        ...targetPermissions,
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
