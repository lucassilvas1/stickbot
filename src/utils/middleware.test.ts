import { type InteractionReplyOptions } from "discord.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateId, getNonLNZCharSet } from "./misc.js";
import { invalidCharGuard, rateLimit } from "./middleware.js";
import { DEFAULT_COMMAND_COOLDOWN_MS } from "./constants.js";
import { mockCommand, mockInteraction } from "./test.js";

describe("rate limiter", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("enforces command specific cooldowns", async () => {
    const command = mockCommand("example", 10_000);
    const interaction = mockInteraction({ userId: generateId(6) });

    vi.useFakeTimers();
    expect(await rateLimit(command, interaction as any)).toBe(false);
    vi.advanceTimersByTime(1_000);
    expect(await rateLimit(command, interaction as any)).toBe(true);
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(
      (interaction.reply.mock.calls[0]![0]! as InteractionReplyOptions).content
    ).toContain("wait");
    expect(
      await rateLimit(mockCommand("othercommand", 5_000), interaction as any)
    ).toBe(false);
    vi.advanceTimersByTime(11_000);
    expect(await rateLimit(command, interaction as any)).toBe(false);
  });

  it("falls back to default cooldown if command doesn't have one set", async () => {
    const command = mockCommand("cmdWithDefaultCooldown");
    const interaction = mockInteraction({ userId: generateId(6) });

    vi.useFakeTimers();
    expect(await rateLimit(command, interaction as any)).toBe(false);
    vi.advanceTimersByTime(DEFAULT_COMMAND_COOLDOWN_MS / 2);
    expect(await rateLimit(command, interaction as any)).toBe(true);
    vi.advanceTimersByTime(DEFAULT_COMMAND_COOLDOWN_MS + 100);
    expect(await rateLimit(command, interaction as any)).toBe(false);
  });

  it("clears cooldown callbacks after cooldown", () => {
    const commandName = "test";
    const cooldown = 5_000;
    const userId = generateId(6);
    const command = mockCommand(commandName, cooldown);
    const interaction = mockInteraction({ userId }) as any;

    vi.useFakeTimers();
    rateLimit(command, interaction!);
    expect(interaction.client!.cooldowns.get(commandName)?.has(userId)).toBe(
      true
    );
    vi.advanceTimersByTime(cooldown + 100);
    expect(interaction.client!.cooldowns.get(commandName)?.has(userId)).toBe(
      false
    );
  });
});

describe("invalid character guard", () => {
  it("replies and resolves true if an unsupported character is found in title or tags", async () => {
    const interaction = mockInteraction({
      userId: "user",
      stringOptions: {
        title: "<t!tle>",
        tags: "[t@gs]",
      },
    });

    expect(await invalidCharGuard(interaction as any)).toBe(true);
    const messageContent = (
      interaction.reply.mock.calls[0]![0] as InteractionReplyOptions
    ).content!;
    expect(
      new Set(["<", "!", ">", "[", "@", "]"]).isSubsetOf(
        new Set(getNonLNZCharSet(messageContent))
      )
    ).toBe(true);
  });

  it("resolves false if no unsupported character is found in title and tags", async () => {
    const interaction = mockInteraction({
      userId: "user",
      stringOptions: {
        title: "title",
        tags: "tags",
      },
    });

    expect(await invalidCharGuard(interaction as any)).toBe(false);
    expect(interaction.reply).toBeCalledTimes(0);
  });
});
