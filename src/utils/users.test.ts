import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  isUploader,
  isFromOwner,
  parsePermissionOptions,
  isUserAllowed,
  authorizeStickerUploader,
  permissionArrayToObj,
  isValidPermissionArray,
  diffPermissions,
  canAlterPermissions,
} from "./users.js";
import { mockBoundDbFunctions, mockInteraction } from "./test.js";
import type { Permissions } from "../types/db.js";

describe("authorizeStickerUploader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false if interaction is not autocomplete or command", async () => {
    const interaction = mockInteraction();
    interaction.isAutocomplete.mockReturnValue(false);
    interaction.isChatInputCommand.mockReturnValue(false);

    const db = mockBoundDbFunctions();

    await expect(
      authorizeStickerUploader(db as any, interaction as any)
    ).resolves.toBe(false);

    expect(interaction.options?.getString).not.toHaveBeenCalled();
  });

  it("allows anyone in the db to get autocomplete suggestions", async () => {
    const interaction = mockInteraction();
    interaction.isAutocomplete.mockReturnValue(true);

    const db = mockBoundDbFunctions();
    db.getUserPermissionsById.mockResolvedValue({} as any);

    await expect(
      authorizeStickerUploader(db as any, interaction as any)
    ).resolves.toBe(true);
  });

  it("keeps users not in db from getting autocomplete suggestions", async () => {
    const interaction = mockInteraction();
    interaction.isAutocomplete.mockReturnValue(true);

    const db = mockBoundDbFunctions();
    db.getUserPermissionsById.mockResolvedValue(undefined);

    await expect(
      authorizeStickerUploader(db as any, interaction as any)
    ).resolves.toBe(false);
  });

  it("returns false if command interaction doesn't have query option", async () => {
    const interaction = mockInteraction();
    interaction.isAutocomplete.mockReturnValue(false);
    interaction.isChatInputCommand.mockReturnValue(true);

    const db = mockBoundDbFunctions();

    await expect(
      authorizeStickerUploader(db as any, interaction as any)
    ).resolves.toBe(false);
  });

  it("returns false if user did not upload the sticker", async () => {
    const interaction = mockInteraction({
      userId: "randomuser",
      stringOptions: { query: "hi" },
    });
    interaction.isAutocomplete.mockReturnValue(false);
    interaction.isChatInputCommand.mockReturnValue(true);

    const db = mockBoundDbFunctions();
    db.getStickerById.mockResolvedValue({
      uploaderId: "uploader",
    } as any);

    await expect(
      authorizeStickerUploader(db as any, interaction as any)
    ).resolves.toBe(false);
  });

  it("returns true if user uploaded the sticker", async () => {
    const interaction = mockInteraction({
      userId: "uploader",
      stringOptions: { query: "hello world" },
    });
    interaction.isAutocomplete.mockReturnValue(false);
    interaction.isChatInputCommand.mockReturnValue(true);

    const db = mockBoundDbFunctions();
    db.getStickerById.mockResolvedValue({
      uploaderId: "uploader",
    } as any);

    await expect(
      authorizeStickerUploader(db as any, interaction as any)
    ).resolves.toBe(true);
  });

  it("does not treat autocomplete interactions as commands", async () => {
    const interaction = mockInteraction({
      stringOptions: { query: "should-not-be-used" },
    });

    interaction.isAutocomplete.mockReturnValue(true);
    interaction.isChatInputCommand.mockReturnValue(true);

    const db = mockBoundDbFunctions();
    db.getUserPermissionsById.mockResolvedValue({} as any);

    const result = await authorizeStickerUploader(
      db as any,
      interaction as any
    );

    expect(result).toBe(true);
    expect(interaction.options.getString).not.toHaveBeenCalled();
  });
});

describe("isUploader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when userId matches sticker uploaderId", async () => {
    const mockSticker = { uploaderId: "user123", id: "sticker1" };

    const db = mockBoundDbFunctions();
    db.getStickerById.mockResolvedValue(mockSticker as any);

    const result = await isUploader(db as any, "user123", "sticker1");

    expect(result).toBe(true);
    expect(db.getStickerById).toHaveBeenCalledWith("sticker1");
  });

  it("returns false when userId does not match sticker uploaderId", async () => {
    const mockSticker = { uploaderId: "user123", id: "sticker1" };

    const db = mockBoundDbFunctions();
    db.getStickerById.mockResolvedValue(mockSticker as any);

    const result = await isUploader(db as any, "user456", "sticker1");

    expect(result).toBe(false);
  });

  it("returns false when sticker is not found", async () => {
    const db = mockBoundDbFunctions();
    db.getStickerById.mockResolvedValue(undefined);

    const result = await isUploader(db as any, "user123", "sticker1");

    expect(result).toBe(false);
  });

  it("returns false when sticker is undefined", async () => {
    const db = mockBoundDbFunctions();
    db.getStickerById.mockResolvedValue(undefined as any);

    const result = await isUploader(db as any, "user123", "sticker1");

    expect(result).toBe(false);
  });
});

describe("isFromOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true for user-owned application when user id matches", () => {
    const userId = "owner123";
    const owner = { id: userId } as any;
    const interaction = mockInteraction({ userId, owner }) as any;

    const result = isFromOwner(interaction);

    expect(result).toBe(true);
  });

  it("returns false for user-owned application when user id does not match", () => {
    const owner = { id: "owner123" } as any;
    const interaction = mockInteraction({ userId: "user456", owner }) as any;

    const result = isFromOwner(interaction);

    expect(result).toBe(false);
  });

  it("returns true for team-owned application when user id matches ownerId", () => {
    const userId = "owner123";
    const owner = { ownerId: userId } as any;
    const interaction = mockInteraction({ userId, owner }) as any;

    const result = isFromOwner(interaction);

    expect(result).toBe(true);
  });

  it("returns false for team-owned application when user id does not match ownerId", () => {
    const owner = { ownerId: "owner123" } as any;
    const interaction = mockInteraction({ userId: "user456", owner }) as any;

    const result = isFromOwner(interaction);

    expect(result).toBe(false);
  });

  it("returns false when owner is null", () => {
    const interaction = mockInteraction({
      userId: "user123",
      owner: null,
    });

    const result = isFromOwner(interaction as any);

    expect(result).toBe(false);
  });

  it("returns false when user id is missing", () => {
    const owner = { id: "owner123" } as any;
    const interaction = mockInteraction({ userId: "", owner }) as any;
    interaction.user.id = undefined;

    const result = isFromOwner(interaction);

    expect(result).toBe(false);
  });
});

describe("parsePermissionOptions", () => {
  it("returns boolean object when type is 'boolean'", () => {
    const interaction = mockInteraction({}) as any;
    // Mock getBoolean to return proper boolean values
    interaction.options.getBoolean = (name: string) => {
      const values: Record<string, boolean | null> = {
        "grant-all": null,
        "add-sticker": true,
        "edit-sticker": false,
        "delete-sticker": true,
        "add-user": false,
        "edit-user": true,
        "delete-user": false,
      };
      return values[name];
    };

    const result = parsePermissionOptions(interaction, "boolean");

    expect(result).toEqual({
      addSticker: true,
      editSticker: false,
      deleteSticker: true,
      addUser: false,
      editUser: true,
      deleteUser: false,
    });
  });

  it("returns integer object (0 or 1) when type is 'integer'", () => {
    const interaction = mockInteraction() as any;

    // Mock getBoolean to return proper boolean values
    interaction.options.getBoolean = (name: string) => {
      const values: Record<string, boolean | null> = {
        "grant-all": null,
        "add-sticker": true,
        "edit-sticker": false,
        "delete-sticker": true,
        "add-user": false,
        "edit-user": true,
        "delete-user": false,
      };
      return values[name];
    };

    const result = parsePermissionOptions(interaction, "integer");

    expect(result).toEqual({
      addSticker: 1,
      editSticker: 0,
      deleteSticker: 1,
      addUser: 0,
      editUser: 1,
      deleteUser: 0,
    });
  });

  it("converts explicitly set false permissions to 0 in integer mode", () => {
    const interaction = mockInteraction() as any;

    interaction.options.getBoolean = (name: string) => {
      if (name === "grant-all") return null;
      return false;
    };

    const result = parsePermissionOptions(interaction, "integer");

    expect(result).toEqual({
      addSticker: 0,
      editSticker: 0,
      deleteSticker: 0,
      addUser: 0,
      editUser: 0,
      deleteUser: 0,
    });
  });

  it("converts explicitly set true permissions to 1 in integer mode", () => {
    const interaction = mockInteraction() as any;

    interaction.options.getBoolean = (name: string) => {
      if (name === "grant-all") return null;
      return true;
    };

    const result = parsePermissionOptions(interaction, "integer");

    expect(result).toEqual({
      addSticker: 1,
      editSticker: 1,
      deleteSticker: 1,
      addUser: 1,
      editUser: 1,
      deleteUser: 1,
    });
  });

  it("converts explicitly set false permissions to false in boolean mode", () => {
    const interaction = mockInteraction() as any;

    interaction.options.getBoolean = (name: string) => {
      if (name === "grant-all") return null;
      return false;
    };

    const result = parsePermissionOptions(interaction, "boolean");

    expect(result).toEqual({
      addSticker: false,
      editSticker: false,
      deleteSticker: false,
      addUser: false,
      editUser: false,
      deleteUser: false,
    });
  });

  it("converts explicitly set true permissions to true in boolean mode", () => {
    const interaction = mockInteraction() as any;

    interaction.options.getBoolean = (name: string) => {
      if (name === "grant-all") return null;
      return true;
    };

    const result = parsePermissionOptions(interaction, "boolean");

    expect(result).toEqual({
      addSticker: true,
      editSticker: true,
      deleteSticker: true,
      addUser: true,
      editUser: true,
      deleteUser: true,
    });
  });

  it("returns undefined for unset permissions in boolean mode", () => {
    const interaction = mockInteraction() as any;

    interaction.options.getBoolean = () => null;

    const result = parsePermissionOptions(interaction, "boolean");

    expect(result).toEqual({
      addSticker: undefined,
      editSticker: undefined,
      deleteSticker: undefined,
      addUser: undefined,
      editUser: undefined,
      deleteUser: undefined,
    });
  });

  it("returns undefined for unset permissions in integer mode", () => {
    const interaction = mockInteraction() as any;

    interaction.options.getBoolean = () => null;

    const result = parsePermissionOptions(interaction, "integer");

    expect(result).toEqual({
      addSticker: undefined,
      editSticker: undefined,
      deleteSticker: undefined,
      addUser: undefined,
      editUser: undefined,
      deleteUser: undefined,
    });
  });

  describe("grantAll option", () => {
    it("grants all permissions when grantAll is true in boolean mode", () => {
      const interaction = mockInteraction() as any;

      interaction.options.getBoolean = (name: string) => {
        if (name === "grant-all") return true;
        return null;
      };

      const result = parsePermissionOptions(interaction, "boolean");

      expect(result).toEqual({
        addSticker: true,
        editSticker: true,
        deleteSticker: true,
        addUser: true,
        editUser: true,
        deleteUser: true,
      });
    });

    it("grants all permissions when grantAll is true in integer mode", () => {
      const interaction = mockInteraction() as any;

      interaction.options.getBoolean = (name: string) => {
        if (name === "grant-all") return true;
        return null;
      };

      const result = parsePermissionOptions(interaction, "integer");

      expect(result).toEqual({
        addSticker: 1,
        editSticker: 1,
        deleteSticker: 1,
        addUser: 1,
        editUser: 1,
        deleteUser: 1,
      });
    });

    it("individual options override grantAll=true in boolean mode", () => {
      const interaction = mockInteraction() as any;

      interaction.options.getBoolean = (name: string) => {
        const values: Record<string, boolean | null> = {
          "grant-all": true,
          "add-sticker": false,
          "delete-sticker": false,
          "delete-user": false,
          "edit-sticker": null,
          "add-user": null,
          "edit-user": null,
        };
        return values[name];
      };

      const result = parsePermissionOptions(interaction, "boolean");

      expect(result).toEqual({
        addSticker: false,
        editSticker: true, // from grantAll
        deleteSticker: false,
        addUser: true, // from grantAll
        editUser: true, // from grantAll
        deleteUser: false,
      });
    });

    it("individual options override grantAll=true in integer mode", () => {
      const interaction = mockInteraction() as any;

      interaction.options.getBoolean = (name: string) => {
        const values: Record<string, boolean | null> = {
          "grant-all": true,
          "add-sticker": false,
          "delete-sticker": false,
          "delete-user": false,
          "edit-sticker": null,
          "add-user": null,
          "edit-user": null,
        };
        return values[name];
      };

      const result = parsePermissionOptions(interaction, "integer");

      expect(result).toEqual({
        addSticker: 0,
        editSticker: 1, // from grantAll
        deleteSticker: 0,
        addUser: 1, // from grantAll
        editUser: 1, // from grantAll
        deleteUser: 0,
      });
    });

    it("individual options override grantAll=false in boolean mode", () => {
      const interaction = mockInteraction() as any;

      interaction.options.getBoolean = (name: string) => {
        const values: Record<string, boolean | null> = {
          "grant-all": false,
          "add-sticker": true,
          "edit-user": true,
          "add-user": true,
          "delete-sticker": null,
          "edit-sticker": null,
          "delete-user": null,
        };
        return values[name];
      };

      const result = parsePermissionOptions(interaction, "boolean");

      expect(result).toEqual({
        addSticker: true,
        editSticker: undefined, // not explicitly set, grantAll=false doesn't affect it
        deleteSticker: undefined, // not explicitly set
        addUser: true,
        editUser: true,
        deleteUser: undefined, // not explicitly set
      });
    });

    it("individual options override grantAll=false in integer mode", () => {
      const interaction = mockInteraction() as any;

      interaction.options.getBoolean = (name: string) => {
        const values: Record<string, boolean | null> = {
          "grant-all": false,
          "add-sticker": true,
          "edit-user": true,
          "add-user": true,
          "delete-sticker": null,
          "edit-sticker": null,
          "delete-user": null,
        };
        return values[name];
      };

      const result = parsePermissionOptions(interaction, "integer");

      expect(result).toEqual({
        addSticker: 1,
        editSticker: undefined,
        deleteSticker: undefined, // not explicitly set
        addUser: 1,
        editUser: 1,
        deleteUser: undefined, // not explicitly set
      });
    });

    it("all individual options can override grantAll in boolean mode", () => {
      const interaction = mockInteraction() as any;

      interaction.options.getBoolean = (name: string) => {
        const values: Record<string, boolean | null> = {
          "grant-all": true,
          "add-sticker": false,
          "edit-sticker": false,
          "delete-sticker": false,
          "add-user": false,
          "edit-user": false,
          "delete-user": false,
        };
        return values[name];
      };

      const result = parsePermissionOptions(interaction, "boolean");

      expect(result).toEqual({
        addSticker: false,
        editSticker: false,
        deleteSticker: false,
        addUser: false,
        editUser: false,
        deleteUser: false,
      });
    });

    it("all individual options can override grantAll in integer mode", () => {
      const interaction = mockInteraction() as any;

      interaction.options.getBoolean = (name: string) => {
        const values: Record<string, boolean | null> = {
          "grant-all": true,
          "add-sticker": false,
          "edit-sticker": false,
          "delete-sticker": false,
          "add-user": false,
          "edit-user": false,
          "delete-user": false,
        };
        return values[name];
      };

      const result = parsePermissionOptions(interaction, "integer");

      expect(result).toEqual({
        addSticker: 0,
        editSticker: 0,
        deleteSticker: 0,
        addUser: 0,
        editUser: 0,
        deleteUser: 0,
      });
    });

    it("only explicitly set permissions are returned in boolean mode", () => {
      const interaction = mockInteraction() as any;

      interaction.options.getBoolean = (name: string) => {
        const values: Record<string, boolean | null> = {
          "grant-all": null,
          "add-sticker": true,
          "edit-sticker": false,
          "delete-sticker": null,
          "add-user": null,
          "edit-user": null,
          "delete-user": null,
        };
        return values[name];
      };

      const result = parsePermissionOptions(interaction, "boolean");

      expect(result).toEqual({
        addSticker: true,
        editSticker: false,
        deleteSticker: undefined,
        addUser: undefined,
        editUser: undefined,
        deleteUser: undefined,
      });
    });

    it("only explicitly set permissions are returned in integer mode", () => {
      const interaction = mockInteraction() as any;

      interaction.options.getBoolean = (name: string) => {
        const values: Record<string, boolean | null> = {
          "grant-all": null,
          "add-sticker": true,
          "edit-sticker": false,
          "delete-sticker": null,
          "add-user": null,
          "edit-user": null,
          "delete-user": null,
        };
        return values[name];
      };

      const result = parsePermissionOptions(interaction, "integer");

      expect(result).toEqual({
        addSticker: 1,
        editSticker: 0,
        deleteSticker: undefined,
        addUser: undefined,
        editUser: undefined,
        deleteUser: undefined,
      });
    });

    it("does not set permissions when grantAll=false in boolean mode", () => {
      const interaction = mockInteraction() as any;

      interaction.options.getBoolean = (name: string) => {
        if (name === "grant-all") return false;
        return null;
      };

      const result = parsePermissionOptions(interaction, "boolean");

      expect(result).toEqual({
        addSticker: undefined,
        editSticker: undefined,
        deleteSticker: undefined,
        addUser: undefined,
        editUser: undefined,
        deleteUser: undefined,
      });
    });

    it("does not set permissions when grantAll=false in integer mode", () => {
      const interaction = mockInteraction() as any;

      interaction.options.getBoolean = (name: string) => {
        if (name === "grant-all") return false;
        return null;
      };

      const result = parsePermissionOptions(interaction, "integer");

      expect(result).toEqual({
        addSticker: undefined,
        editSticker: undefined,
        deleteSticker: undefined,
        addUser: undefined,
        editUser: undefined,
        deleteUser: undefined,
      });
    });
  });
});

describe("isUserAllowed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when user is the app owner regardless of permissions", async () => {
    const userId = "owner123";
    const owner = { id: userId } as any;
    const interaction = mockInteraction({ userId, owner });
    const db = mockBoundDbFunctions();

    const result = await isUserAllowed(
      db as any,
      "addUser",
      interaction as any
    );

    expect(result).toBe(true);
    expect(db.getUserPermissionsById).not.toHaveBeenCalled();
  });

  it("returns true when user has the specific permission", async () => {
    const userId = "user123";
    const interaction = mockInteraction({ userId, owner: null });
    const mockPermissions = {
      addSticker: 1,
      editSticker: 0,
      deleteSticker: 1,
      addUser: 0,
      editUser: 0,
      deleteUser: 0,
    };

    const db = mockBoundDbFunctions();
    db.getUserPermissionsById.mockResolvedValue(mockPermissions as any);

    const result = await isUserAllowed(
      db as any,
      "addSticker",
      interaction as any
    );

    expect(result).toBe(true);
    expect(db.getUserPermissionsById).toHaveBeenCalledWith(userId);
  });

  it("returns false when user does not have the specific permission", async () => {
    const userId = "user123";
    const interaction = mockInteraction({ userId, owner: null });
    const mockPermissions = {
      addSticker: 1,
      editSticker: 0,
      deleteSticker: 1,
      addUser: 0,
      editUser: 0,
      deleteUser: 0,
    };

    const db = mockBoundDbFunctions();
    db.getUserPermissionsById.mockResolvedValue(mockPermissions as any);

    const result = await isUserAllowed(
      db as any,
      "editSticker",
      interaction as any
    );

    expect(result).toBe(false);
  });

  it("returns false when user is not in database", async () => {
    const userId = "user123";
    const interaction = mockInteraction({ userId, owner: null });

    const db = mockBoundDbFunctions();
    db.getUserPermissionsById.mockResolvedValue(undefined);

    const result = await isUserAllowed(
      db as any,
      "addSticker",
      interaction as any
    );

    expect(result).toBe(false);
    expect(db.getUserPermissionsById).toHaveBeenCalledWith(userId);
  });

  it("works with team-owned applications", async () => {
    const userId = "owner123";
    const owner = { ownerId: userId } as any;
    const interaction = mockInteraction({ userId, owner }) as any;
    const db = mockBoundDbFunctions();

    const result = await isUserAllowed(db as any, "addUser", interaction);

    expect(result).toBe(true);
    expect(db.getUserPermissionsById).not.toHaveBeenCalled();
  });

  it("can check all permission types", async () => {
    const userId = "user123";
    const interaction = mockInteraction({ userId, owner: null }) as any;
    const mockPermissions = {
      addSticker: 1,
      editSticker: 1,
      deleteSticker: 0,
      addUser: 0,
      editUser: 1,
      deleteUser: 0,
    };

    const db = mockBoundDbFunctions();
    db.getUserPermissionsById.mockResolvedValue(mockPermissions as any);

    // Test allowed permissions
    expect(await isUserAllowed(db as any, "addSticker", interaction)).toBe(
      true
    );
    expect(await isUserAllowed(db as any, "editSticker", interaction)).toBe(
      true
    );
    expect(await isUserAllowed(db as any, "editUser", interaction)).toBe(true);

    // Test denied permissions
    expect(await isUserAllowed(db as any, "deleteSticker", interaction)).toBe(
      false
    );
    expect(await isUserAllowed(db as any, "addUser", interaction)).toBe(false);
    expect(await isUserAllowed(db as any, "deleteUser", interaction)).toBe(
      false
    );

    // Should have called database only once per call
    expect(db.getUserPermissionsById).toHaveBeenCalledTimes(6);
  });
});

describe("permissionArrayToObj", () => {
  it("converts array with some permissions to object with 1s and 0s", () => {
    const permissions = ["addSticker", "deleteSticker", "editUser"];

    const result = permissionArrayToObj(permissions as (keyof Permissions)[]);

    expect(result).toEqual({
      addSticker: 1,
      editSticker: 0,
      deleteSticker: 1,
      addUser: 0,
      editUser: 1,
      deleteUser: 0,
    });
  });
});

describe("isValidPermissionArray", () => {
  it("returns true for array with all valid permissions", () => {
    const permissions = [
      "addSticker",
      "editSticker",
      "deleteSticker",
      "addUser",
      "editUser",
      "deleteUser",
    ];

    const result = isValidPermissionArray(permissions);

    expect(result).toBe(true);
  });

  it("returns true for empty array", () => {
    const permissions: string[] = [];

    const result = isValidPermissionArray(permissions);

    expect(result).toBe(true);
  });

  it("returns true for single valid permission", () => {
    const permissions = ["addSticker"];

    const result = isValidPermissionArray(permissions);

    expect(result).toBe(true);
  });

  it("returns false for array with one invalid permission", () => {
    const permissions = ["invalidPermission"];

    const result = isValidPermissionArray(permissions);

    expect(result).toBe(false);
  });

  it("returns false for array with some valid and some invalid permissions", () => {
    const permissions = ["addSticker", "invalidPermission", "editUser"];

    const result = isValidPermissionArray(permissions);

    expect(result).toBe(false);
  });

  it("returns false when all permissions are invalid", () => {
    const permissions = ["fakePermission", "notAPermission", "badPerm"];

    const result = isValidPermissionArray(permissions);

    expect(result).toBe(false);
  });

  it("returns true for subset of valid permissions", () => {
    const permissions = ["addSticker", "editUser", "deleteUser"];

    const result = isValidPermissionArray(permissions);

    expect(result).toBe(true);
  });
});

describe("diffPermissions", () => {
  it("returns empty array when both objects are the same", () => {
    const perms = {
      addSticker: 1,
      editSticker: 0,
      deleteSticker: 1,
      addUser: 0,
      editUser: 1,
      deleteUser: 0,
    };

    const result = diffPermissions(perms, perms);

    expect(result).toEqual([]);
  });

  it("returns permission keys that differ between left and right", () => {
    const left = {
      addSticker: 1,
      editSticker: 0,
      deleteSticker: 1,
      addUser: 0,
      editUser: 1,
      deleteUser: 0,
    };
    const right = {
      addSticker: 0, // different
      editSticker: 0,
      deleteSticker: 1,
      addUser: 1, // different
      editUser: 1,
      deleteUser: 1, // different
    };

    const result = diffPermissions(left, right);

    expect(result).toContain("addSticker");
    expect(result).toContain("addUser");
    expect(result).toContain("deleteUser");
    expect(result).not.toContain("editSticker");
    expect(result).not.toContain("deleteSticker");
    expect(result).not.toContain("editUser");
  });

  it("returns all permissions in left when all differ", () => {
    const left = {
      addSticker: 1,
      editSticker: 1,
      deleteSticker: 1,
    } as Permissions;
    const right = {
      addSticker: 0,
      editSticker: 0,
      deleteSticker: 0,
    } as Permissions;

    const result = diffPermissions(left, right);

    expect(result).toEqual(
      expect.arrayContaining(["addSticker", "editSticker", "deleteSticker"])
    );
    expect(result).toHaveLength(3);
  });
});

describe("canAlterPermissions", () => {
  it("returns true when editor has all permissions being changed", () => {
    const editor = {
      addSticker: 1,
      editSticker: 1,
      deleteSticker: 1,
      addUser: 1,
      editUser: 1,
      deleteUser: 1,
    };
    const oldPerms = {
      addSticker: 0,
      editSticker: 0,
      deleteSticker: 0,
      addUser: 0,
      editUser: 0,
      deleteUser: 0,
    };
    const newPerms = {
      addSticker: 1,
      editSticker: 1,
      deleteSticker: 0,
      addUser: 0,
      editUser: 0,
      deleteUser: 0,
    };

    const result = canAlterPermissions(editor, newPerms, oldPerms);

    expect(result).toBe(true);
  });

  it("returns false when editor lacks a permission being granted", () => {
    const editor = {
      addSticker: 1,
      editSticker: 0, // editor doesn't have this
      deleteSticker: 1,
      addUser: 1,
      editUser: 1,
      deleteUser: 1,
    };
    const oldPerms = {
      addSticker: 0,
      editSticker: 0,
      deleteSticker: 0,
      addUser: 0,
      editUser: 0,
      deleteUser: 0,
    };
    const newPerms = {
      addSticker: 0,
      editSticker: 1, // trying to grant this
      deleteSticker: 0,
      addUser: 0,
      editUser: 0,
      deleteUser: 0,
    };

    const result = canAlterPermissions(editor, newPerms, oldPerms);

    expect(result).toBe(false);
  });

  it("returns true when no permissions are being changed", () => {
    const editor = {
      addSticker: 0,
      editSticker: 0,
      deleteSticker: 0,
      addUser: 0,
      editUser: 0,
      deleteUser: 0,
    };
    const oldPerms = {
      addSticker: 0,
      editSticker: 0,
      deleteSticker: 0,
      addUser: 0,
      editUser: 0,
      deleteUser: 0,
    };
    const newPerms = {
      addSticker: 0,
      editSticker: 0,
      deleteSticker: 0,
      addUser: 0,
      editUser: 0,
      deleteUser: 0,
    };

    const result = canAlterPermissions(editor, newPerms, oldPerms);

    expect(result).toBe(true);
  });

  it("doesn't allow removing permissions the editor doesn't have", () => {
    const editor: Permissions = {
      addSticker: 1,
      editSticker: 0, // editor doesn't have this
      deleteSticker: 0,
      addUser: 0,
      editUser: 0,
      deleteUser: 0,
    };
    const oldPerms = {
      addSticker: 0,
      editSticker: 1, // target currently has it
      deleteSticker: 0,
      addUser: 0,
      editUser: 0,
      deleteUser: 0,
    };
    const newPerms: Permissions = {
      addSticker: 0,
      editSticker: 0, // trying to remove it
      deleteSticker: 0,
      addUser: 0,
      editUser: 0,
      deleteUser: 0,
    };

    const result = canAlterPermissions(editor, newPerms, oldPerms);

    expect(result).toBe(false);
  });

  it("handles missing oldPerms", () => {
    const editor = {
      addSticker: 1,
      editSticker: 1,
      deleteSticker: 0,
      addUser: 0,
      editUser: 0,
      deleteUser: 0,
    };
    const newPerms = {
      addSticker: 1,
      editSticker: 1,
      deleteSticker: 0,
      addUser: 0,
      editUser: 0,
      deleteUser: 0,
    };

    const result = canAlterPermissions(editor, newPerms);

    expect(result).toBe(true);
  });
});
