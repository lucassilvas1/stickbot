import {
  Collection,
  MessageFlags,
  ModalSubmitInteraction,
  type CacheType,
  type ChatInputCommandInteraction,
  type Interaction,
} from "discord.js";
import type { CommandData } from "../types/commands.js";
import { DEFAULT_COMMAND_COOLDOWN_MS } from "./constants.js";
import { getNonLNZCharSet } from "./misc.js";
import { isFromOwner } from "./users.js";
import { logger } from "../logging/logger.js";
import type { BoundDBFunctions } from "../db/dbActions.js";

export async function authorization(
  db: BoundDBFunctions,
  command: CommandData,
  interaction: Interaction<CacheType>
) {
  // Owner is always allowed
  if (isFromOwner(interaction)) return true;
  if (command.overridePermissions) {
    // `overridePermissions` is only taken into account if it returns true
    // User may still be allowed if they have all permissions in
    // `command.permissions`
    const overridden = await command.overridePermissions(db, interaction);
    if (overridden) return true;
  }
  // only owner and `overridePermissions` can authorize special commands
  if (command.permissions === "special") return false;

  const permissions = await db.getUserPermissionsById(interaction.user.id);
  if (!permissions) return false;
  // If permissions array is empty, then the user just needs to be in the db
  // to be allowed
  if (command.permissions.length === 0) return true;
  // User needs to have every permission necessary otherwise
  return command.permissions.every((p) => permissions[p]);
}

/**
 * Handles rate limiting for a command interaction.
 * @returns {boolean} True if the interaction is rate limited, false otherwise.
 */
export async function rateLimit(
  command: CommandData,
  interaction: ChatInputCommandInteraction
): Promise<boolean> {
  const { cooldowns } = interaction.client;

  if (!cooldowns.has(command.data.name)) {
    cooldowns.set(command.data.name, new Collection());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(command.data.name);
  const cooldown = command.cooldown ?? DEFAULT_COMMAND_COOLDOWN_MS;

  if (!timestamps) {
    logger.error(
      { command: interaction.commandName, options: interaction.options.data },
      "Timestamps collection not found for command. This code should not be reachable."
    );
    return false;
  }

  const timestamp = timestamps.get(interaction.user.id);

  if (timestamp && now < timestamp + cooldown) {
    const retryTimestamp = Math.round(timestamp + cooldown / 1_000);
    logger.debug(
      { user: interaction.user.id, command: interaction.commandName },
      "user in cooldown"
    );
    await interaction.reply({
      content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again at <t:${retryTimestamp}:R>.`,
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  timestamps.set(interaction.user.id, now);
  setTimeout(() => timestamps.delete(interaction.user.id), cooldown);

  return false;
}

/**
 * @param interaction The interaction to check
 * @returns {Promise<boolean>} Resolves to true if invalid characters were found,
 * false otherwise
 */
export async function invalidCharGuard(
  interaction: ChatInputCommandInteraction | ModalSubmitInteraction
) {
  const getValue = interaction.isChatInputCommand()
    ? (key: string) => interaction.options.getString(key)
    : (key: string) => {
        try {
          return interaction.fields.getTextInputValue(key);
        } catch (_) {
          return "";
        }
      };

  const title = getValue("title") ?? "";
  const tags = getValue("tags") ?? "";
  const username = getValue("username") ?? "";
  const invalidChars = getNonLNZCharSet(title + tags + username);

  if (invalidChars.length > 0) {
    logger.debug({ invalidChars }, "found invalid chars");
    await interaction.reply({
      content: `Titles, tags and usernames can only contain letters, numbers, and spaces. The following characters are not allowed: ${invalidChars.join(
        " "
      )}.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  return invalidChars.length > 0;
}
