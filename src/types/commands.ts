import type {
  AutocompleteInteraction,
  CacheType,
  ChatInputCommandInteraction,
  Collection,
  Interaction,
  SlashCommandOptionsOnlyBuilder,
} from "discord.js";
import type { Permissions } from "./db.js";

export type CommandExecutor = (
  interaction: ChatInputCommandInteraction
) => Promise<unknown> | unknown;

export type CommandAutocomplete = (
  interaction: AutocompleteInteraction
) => Promise<void> | void;

export type CommandData = {
  isGlobal?: boolean;
  cooldown?: number;
  overridePermissions?: (
    interaction: Interaction<CacheType>
  ) => Promise<boolean> | boolean;
  permissions: (keyof Permissions)[] | "special";
  data: SlashCommandOptionsOnlyBuilder;
  execute: CommandExecutor;
  autocomplete?: CommandAutocomplete;
};

export type CooldownCollection = Collection<string, Collection<string, number>>;
