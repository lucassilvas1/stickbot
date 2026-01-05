import { type InteractionReplyOptions } from "discord.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateId, getNonLNZCharSet } from "./misc.js";
import { authorization, invalidCharGuard, rateLimit } from "./middleware.js";
import { DEFAULT_COMMAND_COOLDOWN_MS } from "./constants.js";
import { mockCommand, mockInteraction } from "./test.js";
import { isFromOwner } from "./users.js";
import { getUserPermissionsById } from "../db/dbActions.js";

vi.mock("../db/db.js");
vi.mock("./users.js", () => ({ isFromOwner: vi.fn() }));
vi.mock("../db/dbActions.js", () => ({ getUserPermissionsById: vi.fn() }));

describe("authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows the owner unconditionally", async () => {
    vi.mocked(isFromOwner).mockReturnValue(true);
    const interaction = mockInteraction({
      owner: { id: "user" },
      userId: "user",
    } as any);
    const result = await authorization(mockCommand(), interaction as any);

    expect(result).toBe(true);
    expect(getUserPermissionsById).not.toHaveBeenCalled();
  });

  it("allows when overridePermissions returns true", async () => {
    vi.mocked(isFromOwner).mockReturnValue(false);

    const overridePermissions = vi.fn().mockResolvedValue(true);

    const result = await authorization(
      mockCommand({ overridePermissions }),
      mockInteraction() as any
    );

    expect(result).toBe(true);
    expect(overridePermissions).toHaveBeenCalled();
    expect(getUserPermissionsById).not.toHaveBeenCalled();
  });

  it("falls through when overridePermissions returns false", async () => {
    vi.mocked(isFromOwner).mockReturnValue(false);
    vi.mocked(getUserPermissionsById).mockResolvedValue({
      editSticker: 1,
    } as any);

    const result = await authorization(
      mockCommand({
        overridePermissions: vi.fn().mockResolvedValue(false),
        permissions: ["editSticker"],
      }),
      mockInteraction() as any
    );

    expect(result).toBe(true);
  });

  it("lets owner through for special commands", async () => {
    vi.mocked(isFromOwner).mockReturnValue(true);

    const command = mockCommand({
      permissions: "special",
      overridePermissions: vi.fn(),
    });
    const result = await authorization(command, mockInteraction() as any);

    expect(result).toBe(true);
    expect(command.overridePermissions).not.toHaveBeenCalled();
    expect(getUserPermissionsById).not.toHaveBeenCalled();
  });

  it("lets user through if overridePermissions returns true", async () => {
    vi.mocked(isFromOwner).mockReturnValue(false);

    const command = mockCommand({
      permissions: "special",
      overridePermissions: vi.fn().mockReturnValue(true),
    });
    const result = await authorization(command, mockInteraction() as any);

    expect(result).toBe(true);
    expect(getUserPermissionsById).not.toHaveBeenCalled();
  });

  it("denies user if not owner and overridePermissions returns false", async () => {
    vi.mocked(isFromOwner).mockReturnValue(false);

    const command = mockCommand({
      permissions: "special",
      overridePermissions: vi.fn().mockReturnValue(false),
    });

    const result = await authorization(command, mockInteraction() as any);

    expect(result).toBe(false);
    expect(getUserPermissionsById).not.toHaveBeenCalled();
  });

  it("lets user through if they're in db and command permission array is empty", async () => {
    vi.mocked(isFromOwner).mockReturnValue(false);
    vi.mocked(getUserPermissionsById).mockResolvedValue({} as any);

    const result = await authorization(
      mockCommand({ permissions: [] }),
      mockInteraction() as any
    );

    expect(result).toBe(true);
  });

  it("allows user with all required permissions", async () => {
    vi.mocked(isFromOwner).mockReturnValue(false);
    vi.mocked(getUserPermissionsById).mockResolvedValue({
      editUser: 1,
      deleteUser: 1,
    } as any);

    const result = await authorization(
      mockCommand({
        permissions: ["editUser", "deleteUser"],
      }),
      mockInteraction() as any
    );

    expect(result).toBe(true);
  });

  it("denies user missing at least one permission", async () => {
    vi.mocked(isFromOwner).mockReturnValue(false);
    vi.mocked(getUserPermissionsById).mockResolvedValue({
      editUser: 1,
    } as any);

    const result = await authorization(
      mockCommand({
        permissions: ["editUser", "deleteUser"],
      }),
      mockInteraction() as any
    );

    expect(result).toBe(false);
  });

  it("denies user not found in database and replies", async () => {
    vi.mocked(isFromOwner).mockReturnValue(false);
    vi.mocked(getUserPermissionsById).mockResolvedValue(undefined);

    const result = await authorization(
      mockCommand({ permissions: ["addUser"] }),
      mockInteraction() as any
    );

    expect(result).toBe(false);
  });
});

describe("rate limiter", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("enforces command specific cooldowns", async () => {
    const command = mockCommand({ name: "example", cooldown: 10_000 });
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
      await rateLimit(
        mockCommand({ name: "othercommand", cooldown: 5_000 }),
        interaction as any
      )
    ).toBe(false);
    vi.advanceTimersByTime(11_000);
    expect(await rateLimit(command, interaction as any)).toBe(false);
  });

  it("falls back to default cooldown if command doesn't have one set", async () => {
    const command = mockCommand({ name: "cmdWithDefaultCooldown" });
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
    const command = mockCommand({ name: commandName, cooldown });
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

    interaction.isChatInputCommand.mockReturnValue(true);

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

    await expect(invalidCharGuard(interaction as any)).resolves.toBe(false);
    expect(interaction.reply).toBeCalledTimes(0);
  });

  it("resolves false if no unsupported character is found in username", async () => {
    const interaction = mockInteraction({
      fields: { username: "allowed nickname 123" },
    });

    interaction.isChatInputCommand.mockReturnValue(false);

    await expect(invalidCharGuard(interaction as any)).resolves.toBe(false);
  });

  it("resolves true if any unsupported character is found in username", async () => {
    const interaction = mockInteraction({
      fields: { username: "forb!dden_username" },
    });

    interaction.isChatInputCommand.mockReturnValue(false);

    await expect(invalidCharGuard(interaction as any)).resolves.toBe(true);
  });
});
