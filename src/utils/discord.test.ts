import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCommands, registerEventHandlers } from "./discord.js";
import type { Client } from "discord.js";

describe("getCommands", () => {
  it("returns an array of all command handlers in the project", async () => {
    const commands = await getCommands();
    expect(commands.every((c) => "data" in c && "execute" in c)).toBe(true);
  });
});

describe("registerEventHandlers", () => {
  let mockClient: Partial<Client>;

  beforeEach(() => {
    mockClient = {
      once: vi.fn(),
      on: vi.fn(),
    };
  });

  it("registers once handlers with client.once()", async () => {
    await registerEventHandlers(mockClient as Client);
    // Should call either once or on depending on handler configuration
    expect((mockClient.once as any)?.mock?.calls?.length > 0).toBe(true);
  });

  it("registers on handlers with client.on()", async () => {
    await registerEventHandlers(mockClient as Client);
    expect((mockClient.on as any)?.mock?.calls?.length > 0).toBe(true);
  });

  it("passes handler name and wrapped handler function to client", async () => {
    await registerEventHandlers(mockClient as Client);
    // Verify that at least one handler was registered
    const totalCalls =
      ((mockClient.once as any)?.mock?.calls?.length || 0) +
      ((mockClient.on as any)?.mock?.calls?.length || 0);
    expect(totalCalls).toBeGreaterThan(0);

    // Verify each registration has [name, handler] signature
    const allCalls = [
      ...((mockClient.once as any)?.mock?.calls || []),
      ...((mockClient.on as any)?.mock?.calls || []),
    ];
    allCalls.forEach((call: any) => {
      expect(call.length).toBe(2);
      expect(typeof call[0]).toBe("string");
      expect(typeof call[1]).toBe("function");
    });
  });
});
