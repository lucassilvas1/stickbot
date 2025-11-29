import {
  Collection,
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { CommandData } from "../types/commands.js";
import { DEFAULT_COMMAND_COOLDOWN_MS } from "./constants.js";
import { getNonLNZCharSet } from "./misc.js";

/**
 * Handles rate limiting for a command interaction.
 * @returns {boolean} True if the interaction is rate limited, false otherwise.
 */
export function rateLimit(
  command: CommandData,
  interaction: ChatInputCommandInteraction
): boolean {
  const { cooldowns } = interaction.client;

  if (!cooldowns.has(command.data.name)) {
    cooldowns.set(command.data.name, new Collection());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(command.data.name);
  const cooldown = command.cooldown ?? DEFAULT_COMMAND_COOLDOWN_MS;

  if (!timestamps) {
    console.error(
      "Timestamps collection not found for command. This code should not be reachable."
    );
    return false;
  }

  const timestamp = timestamps.get(interaction.user.id);

  if (timestamp && now < timestamp + cooldown) {
    const retryTimestamp = Math.round(timestamp + cooldown / 1_000);
    interaction.reply({
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
  interaction: ChatInputCommandInteraction
) {
  const title = interaction.options.getString("title") ?? "";
  const tags = interaction.options.getString("tags") ?? "";
  const invalidChars = getNonLNZCharSet(title + tags);

  if (invalidChars.length > 0) {
    await interaction.reply({
      content: `The title and tags can only contain letters, numbers, and spaces. The following characters are not allowed: ${invalidChars.join(
        " "
      )}. Use Ctrl+Z to remove them and try again.`,
    });
  }

  return invalidChars.length > 0;
}
