import { describe, expect, it } from "vitest";
import { TypedError } from "./error.js";

describe("TypedError", () => {
  it("creates an error with a code and message", () => {
    const error = new TypedError("INVALID_TYPE", {
      message: "Input is invalid",
    });

    expect(error.code).toBe("INVALID_TYPE");
    expect(error.message).toBe("Input is invalid");
    expect(error.name).toBe("TypedError");
  });

  it("creates an error with a code and cause", () => {
    const cause = new Error("Original error");
    const error = new TypedError("PROCESSING_ERROR", { cause });

    expect(error.code).toBe("PROCESSING_ERROR");
    expect(error.cause).toBe(cause);
  });

  it("creates an error with both message and cause", () => {
    const cause = new Error("Original error");
    const error = new TypedError("FFMPEG_ERROR", {
      message: "Something went wrong",
      cause,
    });

    expect(error.code).toBe("FFMPEG_ERROR");
    expect(error.message).toBe("Something went wrong");
    expect(error.cause).toBe(cause);
  });

  it("creates an error with only a code when options are empty", () => {
    const error = new TypedError("HTTP");

    expect(error.code).toBe("HTTP");
    expect(error.message).toBe("");
    expect(error.cause).toBeUndefined();
  });

  it("is an instance of Error", () => {
    const error = new TypedError("TOO_LARGE");
    expect(error instanceof Error).toBe(true);
  });
});
