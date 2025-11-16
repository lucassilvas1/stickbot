import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Collection,
  SlashCommandBuilder,
} from "discord.js";

export type CommandExecutor = (
  interaction: ChatInputCommandInteraction
) => Promise<unknown> | unknown;

export type CommandAutocomplete = (
  interaction: AutocompleteInteraction
) => Promise<void> | void;

export type CommandData = {
  isGlobal?: boolean;
  cooldown?: number;
  data: SlashCommandBuilder;
  execute: CommandExecutor;
  autocomplete?: CommandAutocomplete;
};

export type CooldownCollection = Collection<string, Collection<string, number>>;
