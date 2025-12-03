import {
  ChatInputCommandInteraction,
  Collection,
  type InteractionReplyOptions,
} from "discord.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateId, getNonLNZCharSet } from "./misc.js";
import { invalidCharGuard, rateLimit } from "./middleware.js";
import type { CommandData } from "../types/commands.js";
import { DEFAULT_COMMAND_COOLDOWN_MS } from "./constants.js";

describe("rate limiter", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("enforces command specific cooldowns", async () => {
    const command = mockCommand("example", 10_000);
    const interaction = mockInteraction(generateId(6));
    const replySpy = vi.spyOn(interaction, "reply");

    vi.useFakeTimers();
    expect(await rateLimit(command, interaction)).toBe(false);
    vi.advanceTimersByTime(1_000);
    expect(await rateLimit(command, interaction)).toBe(true);
    expect(replySpy).toHaveBeenCalledTimes(1);
    expect(
      (replySpy.mock.calls[0]![0]! as InteractionReplyOptions).content
    ).toContain("wait");
    expect(
      await rateLimit(mockCommand("othercommand", 5_000), interaction)
    ).toBe(false);
    vi.advanceTimersByTime(11_000);
    expect(await rateLimit(command, interaction)).toBe(false);
  });

  it("falls back to default cooldown if command doesn't have one set", async () => {
    const command = mockCommand("cmdWithDefaultCooldown");
    const interaction = mockInteraction(generateId(6));

    vi.useFakeTimers();
    expect(await rateLimit(command, interaction)).toBe(false);
    vi.advanceTimersByTime(DEFAULT_COMMAND_COOLDOWN_MS / 2);
    expect(await rateLimit(command, interaction)).toBe(true);
    vi.advanceTimersByTime(DEFAULT_COMMAND_COOLDOWN_MS + 100);
    expect(await rateLimit(command, interaction)).toBe(false);
  });

  it("clears cooldown callbacks after cooldown", () => {
    const commandName = "test";
    const cooldown = 5_000;
    const userId = generateId(6);
    const command = mockCommand(commandName, cooldown);
    const interaction = mockInteraction(userId);

    vi.useFakeTimers();
    rateLimit(command, interaction);
    expect(interaction.client.cooldowns.get(commandName)?.has(userId)).toBe(
      true
    );
    vi.advanceTimersByTime(cooldown + 100);
    expect(interaction.client.cooldowns.get(commandName)?.has(userId)).toBe(
      false
    );
  });
});

describe("invalid character guard", () => {
  it("replies and resolves true if an unsupported character is found in title or tags", async () => {
    const interaction = mockInteraction("user", {
      title: "<t!tle>",
      tags: "[t@gs]",
    });
    const replySpy = vi.spyOn(interaction, "reply");

    expect(await invalidCharGuard(interaction)).toBe(true);
    const messageContent = (
      replySpy.mock.calls[0]![0] as InteractionReplyOptions
    ).content!;
    expect(
      new Set(["<", "!", ">", "[", "@", "]"]).isSubsetOf(
        new Set(getNonLNZCharSet(messageContent))
      )
    ).toBe(true);
  });

  it("resolves false if no unsupported character is found in title and tags", async () => {
    const interaction = mockInteraction("user", {
      title: "title",
      tags: "tags",
    });
    const replySpy = vi.spyOn(interaction, "reply");

    expect(await invalidCharGuard(interaction)).toBe(false);
    expect(replySpy).toBeCalledTimes(0);
  });
});

function mockCommand(name: string, cooldown?: number) {
  return { data: { name }, cooldown } as CommandData;
}

function mockInteraction(userId: string, options: Record<string, string> = {}) {
  return {
    user: { id: userId },
    client: {
      cooldowns: new Collection(),
    },
    options: {
      getString(name) {
        return options[name];
      },
    },
    async reply(options) {
      return options;
    },
  } as ChatInputCommandInteraction;
}
