import { MessageFlags } from "discord.js";
import type { CommandData } from "../../types/commands.js";
import { baseUserCommand, parsePermissionOptions } from "../../utils/users.js";
import { logger } from "../../logging/logger.js";
import { invalidCharGuard } from "../../utils/middleware.js";

const commandData: CommandData = {
  isGlobal: false,
  permissions: ["addUser"],
  data: baseUserCommand(true)
    .setName("adduser")
    .setDescription(
      "Add a new user to database. All permissions default to false"
    ),
  async execute(db, interaction) {
    const isInvalidInput = await invalidCharGuard(interaction);
    if (isInvalidInput) return;

    const targetId = interaction.options.getString("id", true);
    const username = interaction.options.getString("username", true);
    const permissions = parsePermissionOptions(interaction, "integer");
    const info = {
      targetId,
      userId: interaction.user.id,
      username,
      permissions,
    };

    try {
      const inserted = await db.insertUserPermissions({
        id: targetId,
        username,
        ...permissions,
      });
      if (inserted) {
        logger.info(info, "added user");
        return interaction.reply({
          content: `${username} (${targetId}) has been added to the database`,
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
