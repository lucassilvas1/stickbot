import type { ChatInputCommandInteraction } from "discord.js";

export function rebuildCommand(
  interaction: ChatInputCommandInteraction,
  ...options: string[]
) {
  let command = `/${interaction.commandName}`;

  for (const option of options) {
    const value = interaction.options.getString(option);
    if (!value) continue;

    command += ` ${option}:${value}`;
  }

  return command;
}
