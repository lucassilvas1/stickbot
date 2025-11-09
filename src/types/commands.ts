import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Collection,
  InteractionResponse,
  SlashCommandBuilder,
} from "discord.js";

export type CommandExecutor = (
  interaction: ChatInputCommandInteraction
) => Promise<InteractionResponse | void> | void;

export type CommandAutocomplete = (
  interaction: AutocompleteInteraction
) => Promise<void> | void;

export type CommandData = {
  cooldown?: number;
  data: SlashCommandBuilder;
  execute: CommandExecutor;
  autocomplete?: CommandAutocomplete;
};

export type CooldownCollection = Collection<string, Collection<string, number>>;
