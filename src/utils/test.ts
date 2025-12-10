import {
  ChatInputCommandInteraction,
  Collection,
  type User,
  type Team,
  type CacheType,
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
  };
}

export function mockCommand(name: string, cooldown?: number): CommandData {
  return { data: { name }, cooldown } as CommandData;
}
