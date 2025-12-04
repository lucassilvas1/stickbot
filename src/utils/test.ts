import {
  ChatInputCommandInteraction,
  Collection,
  type User,
  type Team,
  type CacheType,
} from "discord.js";
import type { CommandData } from "../types/commands.js";

type MockInteractionOptions = {
  userId?: string;
  stringOptions?: Record<string, string>;
  owner?: User | Team | null;
};

/**
 * Creates a mock ChatInputCommandInteraction for testing.
 * @param options Configuration for the mock interaction
 * @returns A partial mock of ChatInputCommandInteraction
 */
export function mockInteraction(
  options: MockInteractionOptions = {}
): ChatInputCommandInteraction<CacheType> {
  const { userId = "test-user-id", stringOptions = {}, owner = null } = options;

  return {
    user: { id: userId } as any,
    client: {
      cooldowns: new Collection(),
      application: {
        owner,
      },
    } as any,
    options: {
      getString(name: string) {
        return stringOptions[name];
      },
    } as any,
    async reply(options: any) {
      return options;
    },
  } as ChatInputCommandInteraction<CacheType>;
}

export function mockCommand(name: string, cooldown?: number): CommandData {
  return { data: { name }, cooldown } as CommandData;
}
