import type {
  AutocompleteInteraction,
  CacheType,
  ChatInputCommandInteraction,
  Collection,
  Interaction,
  SlashCommandOptionsOnlyBuilder,
} from "discord.js";
import type { Permissions } from "./db.js";
import type { BoundDBFunctions } from "../db/dbActions.js";

export type CommandExecutor = (
  db: BoundDBFunctions,
  interaction: ChatInputCommandInteraction
) => Promise<unknown> | unknown;

export type CommandAutocomplete = (
  db: BoundDBFunctions,
  interaction: AutocompleteInteraction
) => Promise<void> | void;

export type CommandData = {
  isGlobal?: boolean;
  cooldown?: number;
  overridePermissions?: (
    db: BoundDBFunctions,
    interaction: Interaction<CacheType>
  ) => Promise<boolean> | boolean;
  permissions: (keyof Permissions)[] | "special";
  data: SlashCommandOptionsOnlyBuilder;
  execute: CommandExecutor;
  autocomplete?: CommandAutocomplete;
};

export type CooldownCollection = Collection<string, Collection<string, number>>;
