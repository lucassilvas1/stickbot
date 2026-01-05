import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  isUploader,
  isFromOwner,
  parsePermissionOptions,
  isUserAllowed,
  getUserPermissionWeight,
  authorizeStickerUploader,
  permissionArrayToObj,
  isValidPermissionArray,
} from "./users.js";
import * as dbActions from "../db/dbActions.js";
import { mockInteraction } from "./test.js";
import type { Permissions } from "../types/db.js";

vi.mock("../db/db.js");
vi.mock("../db/dbActions.js");

describe("authorizeStickerUploader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false if interaction is not autocomplete or command", async () => {
    const interaction = mockInteraction();
    interaction.isAutocomplete.mockReturnValue(false);
    interaction.isChatInputCommand.mockReturnValue(false);
    await expect(authorizeStickerUploader(interaction as any)).resolves.toBe(
      false
    );
    expect(interaction.options?.getString).not.toHaveBeenCalled();
  });

  it("allows anyone in the db to get autocomplete suggestions", async () => {
    const interaction = mockInteraction();
    interaction.isAutocomplete.mockReturnValue(true);
    vi.mocked(dbActions.getUserPermissionsById).mockResolvedValue({} as any);
    await expect(authorizeStickerUploader(interaction as any)).resolves.toBe(
      true
    );
  });

  it("keeps users not in db from getting autocomplete suggestions", async () => {
    const interaction = mockInteraction();
    interaction.isAutocomplete.mockReturnValue(true);
    vi.mocked(dbActions.getUserPermissionsById).mockResolvedValue(undefined);
    await expect(authorizeStickerUploader(interaction as any)).resolves.toBe(
      false
    );
  });

  it("returns false if command interaction doesn't have query option", async () => {
    const interaction = mockInteraction();
    interaction.isAutocomplete.mockReturnValue(false);
    interaction.isChatInputCommand.mockReturnValue(true);
    await expect(authorizeStickerUploader(interaction as any)).resolves.toBe(
      false
    );
  });

  it("returns false if user did not upload the sticker", async () => {
    const interaction = mockInteraction({
      userId: "randomuser",
      stringOptions: { query: "hi" },
    });
    interaction.isAutocomplete.mockReturnValue(false);
    interaction.isChatInputCommand.mockReturnValue(true);
    vi.mocked(dbActions.getStickerById).mockResolvedValue({
      uploaderId: "uploader",
    } as any);
    await expect(authorizeStickerUploader(interaction as any)).resolves.toBe(
      false
    );
  });

  it("returns true if user uploaded the sticker", async () => {
    const interaction = mockInteraction({
      userId: "uploader",
      stringOptions: { query: "hello world" },
    });
    interaction.isAutocomplete.mockReturnValue(false);
    interaction.isChatInputCommand.mockReturnValue(true);
    vi.mocked(dbActions.getStickerById).mockResolvedValue({
      uploaderId: "uploader",
    } as any);
    await expect(authorizeStickerUploader(interaction as any)).resolves.toBe(
      true
    );
  });

  it("does not treat autocomplete interactions as commands", async () => {
    const interaction = mockInteraction({
      stringOptions: { query: "should-not-be-used" },
    });

    interaction.isAutocomplete.mockReturnValue(true);
    interaction.isChatInputCommand.mockReturnValue(true);

    vi.mocked(dbActions.getUserPermissionsById).mockResolvedValue({} as any);

    const result = await authorizeStickerUploader(interaction as any);

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
    vi.mocked(dbActions.getStickerById).mockResolvedValue(mockSticker as any);

    const result = await isUploader("user123", "sticker1");

    expect(result).toBe(true);
    expect(dbActions.getStickerById).toHaveBeenCalledWith("sticker1");
  });

  it("returns false when userId does not match sticker uploaderId", async () => {
    const mockSticker = { uploaderId: "user123", id: "sticker1" };
    vi.mocked(dbActions.getStickerById).mockResolvedValue(mockSticker as any);

    const result = await isUploader("user456", "sticker1");

    expect(result).toBe(false);
  });

  it("returns false when sticker is not found", async () => {
    vi.mocked(dbActions.getStickerById).mockResolvedValue(undefined);

    const result = await isUploader("user123", "sticker1");

    expect(result).toBe(false);
  });

  it("returns false when sticker is undefined", async () => {
    vi.mocked(dbActions.getStickerById).mockResolvedValue(undefined as any);

    const result = await isUploader("user123", "sticker1");

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

    const result = await isUserAllowed("addUser", interaction as any);

    expect(result).toBe(true);
    expect(dbActions.getUserPermissionsById).not.toHaveBeenCalled();
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

    vi.mocked(dbActions.getUserPermissionsById).mockResolvedValue(
      mockPermissions as any
    );

    const result = await isUserAllowed("addSticker", interaction as any);

    expect(result).toBe(true);
    expect(dbActions.getUserPermissionsById).toHaveBeenCalledWith(userId);
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

    vi.mocked(dbActions.getUserPermissionsById).mockResolvedValue(
      mockPermissions as any
    );

    const result = await isUserAllowed("editSticker", interaction as any);

    expect(result).toBe(false);
  });

  it("returns false when user is not in database", async () => {
    const userId = "user123";
    const interaction = mockInteraction({ userId, owner: null });

    vi.mocked(dbActions.getUserPermissionsById).mockResolvedValue(undefined);

    const result = await isUserAllowed("addSticker", interaction as any);

    expect(result).toBe(false);
    expect(dbActions.getUserPermissionsById).toHaveBeenCalledWith(userId);
  });

  it("works with team-owned applications", async () => {
    const userId = "owner123";
    const owner = { ownerId: userId } as any;
    const interaction = mockInteraction({ userId, owner }) as any;

    const result = await isUserAllowed("addUser", interaction);

    expect(result).toBe(true);
    expect(dbActions.getUserPermissionsById).not.toHaveBeenCalled();
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

    vi.mocked(dbActions.getUserPermissionsById).mockResolvedValue(
      mockPermissions as any
    );

    // Test allowed permissions
    expect(await isUserAllowed("addSticker", interaction)).toBe(true);
    expect(await isUserAllowed("editSticker", interaction)).toBe(true);
    expect(await isUserAllowed("editUser", interaction)).toBe(true);

    // Test denied permissions
    expect(await isUserAllowed("deleteSticker", interaction)).toBe(false);
    expect(await isUserAllowed("addUser", interaction)).toBe(false);
    expect(await isUserAllowed("deleteUser", interaction)).toBe(false);

    // Should have called database only once per call
    expect(dbActions.getUserPermissionsById).toHaveBeenCalledTimes(6);
  });
});

describe("getUserPermissionWeight", () => {
  // Permission weights from constants:
  // editSticker: 1
  // deleteSticker: 2
  // addSticker: 3
  // editUser: 4
  // deleteUser: 5
  // addUser: 6

  it("returns 0 when user has no permissions", () => {
    const user = {
      addSticker: 0,
      editSticker: 0,
      deleteSticker: 0,
      addUser: 0,
      editUser: 0,
      deleteUser: 0,
    };

    const weight = getUserPermissionWeight(user);

    expect(weight).toBe(0);
  });

  it("returns 1 for editSticker permission only", () => {
    const user = {
      addSticker: 0,
      editSticker: 1,
      deleteSticker: 0,
      addUser: 0,
      editUser: 0,
      deleteUser: 0,
    };

    const weight = getUserPermissionWeight(user);

    expect(weight).toBe(1);
  });

  it("returns 2 for deleteSticker permission only", () => {
    const user = {
      addSticker: 0,
      editSticker: 0,
      deleteSticker: 1,
      addUser: 0,
      editUser: 0,
      deleteUser: 0,
    };

    const weight = getUserPermissionWeight(user);

    expect(weight).toBe(2);
  });

  it("returns 3 for addSticker permission only", () => {
    const user = {
      addSticker: 1,
      editSticker: 0,
      deleteSticker: 0,
      addUser: 0,
      editUser: 0,
      deleteUser: 0,
    };

    const weight = getUserPermissionWeight(user);

    expect(weight).toBe(3);
  });

  it("returns 4 for editUser permission only", () => {
    const user = {
      addSticker: 0,
      editSticker: 0,
      deleteSticker: 0,
      addUser: 0,
      editUser: 1,
      deleteUser: 0,
    };

    const weight = getUserPermissionWeight(user);

    expect(weight).toBe(4);
  });

  it("returns 5 for deleteUser permission only", () => {
    const user = {
      addSticker: 0,
      editSticker: 0,
      deleteSticker: 0,
      addUser: 0,
      editUser: 0,
      deleteUser: 1,
    };

    const weight = getUserPermissionWeight(user);

    expect(weight).toBe(5);
  });

  it("returns 6 for addUser permission only", () => {
    const user = {
      addSticker: 0,
      editSticker: 0,
      deleteSticker: 0,
      addUser: 1,
      editUser: 0,
      deleteUser: 0,
    };

    const weight = getUserPermissionWeight(user);

    expect(weight).toBe(6);
  });

  it("returns highest weight when multiple permissions are granted", () => {
    const user = {
      addSticker: 1,
      editSticker: 1,
      deleteSticker: 0,
      addUser: 0,
      editUser: 1,
      deleteUser: 0,
    };

    const weight = getUserPermissionWeight(user);

    // Should return 4 (editUser) not 3 (addSticker) or 1 (editSticker)
    expect(weight).toBe(4);
  });

  it("returns highest weight when all permissions are granted", () => {
    const user = {
      addSticker: 1,
      editSticker: 1,
      deleteSticker: 1,
      addUser: 1,
      editUser: 1,
      deleteUser: 1,
    };

    const weight = getUserPermissionWeight(user);

    // Should return 6 (addUser is highest)
    expect(weight).toBe(6);
  });

  it("handles mixed low and high permissions correctly", () => {
    const user = {
      addSticker: 0,
      editSticker: 1, // weight 1
      deleteSticker: 0,
      addUser: 0,
      editUser: 0,
      deleteUser: 1, // weight 5
    };

    const weight = getUserPermissionWeight(user);

    // Should return 5 (deleteUser is highest)
    expect(weight).toBe(5);
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
