import {
  Collection,
  type User,
  type Team,
  type CacheType,
  type Interaction,
} from "discord.js";
import type { CommandData } from "../types/commands.js";
import { vi } from "vitest";

type MockInteractionOptions = {
  userId?: string;
  stringOptions?: Record<string, string>;
  owner?: User | Team | null;
};

export function mockInteraction(options: MockInteractionOptions = {}) {
  const { userId = "test-user-id", stringOptions = {}, owner = null } = options;
  return {
    user: { id: userId },
    client: {
      cooldowns: new Collection(),
      application: {
        owner,
      },
    },
    options: {
      getString: vi.fn().mockImplementation((name: string) => {
        return stringOptions[name];
      }),
    },
    reply: vi.fn(),
    respond: vi.fn(),
    isAutocomplete: vi.fn(),
    isChatInputCommand: vi.fn(),
  };
}

type MockCommandOptions = {
  name?: string;
  cooldown?: number;
  overridePermissions?: (
    interaction: Interaction<CacheType>
  ) => Promise<boolean> | Boolean;
  permissions?: string[] | "special";
};

export function mockCommand({
  name,
  cooldown,
  overridePermissions,
  permissions,
}: MockCommandOptions = {}): CommandData {
  return {
    data: { name: name ?? "commandName" },
    cooldown,
    overridePermissions,
    permissions: permissions ?? [],
  } as CommandData;
}
