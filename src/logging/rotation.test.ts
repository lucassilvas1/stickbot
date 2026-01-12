import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import { basename, dirname, join } from "path";
import { tmpdir } from "os";
import type { RotationConfig } from "./rotation.js";
import {
  setUpLogRotation,
  stopLogRotation,
  writeLogFileMetadata,
  readLogFileMetadata,
  ensureMetadataFile,
  shouldRotate,
  breakDownPath,
  getRotatedLogFiles,
  cleanupOldRotations,
  cleanUpOrphanMetadata,
  rotateLogFile,
} from "./rotation.js";

const testDir = join(tmpdir(), "stickbot-rotation-tests");
let logFilePath: string;

async function createTestFile(path: string, size: number = 100) {
  const dir = dirname(path);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path, Buffer.alloc(size));
}

describe("Log Rotation", () => {
  beforeEach(async () => {
    logFilePath = join(testDir, `test-${Date.now()}.log`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Metadata File Management", () => {
    it("should write metadata file with current timestamp", async () => {
      const metaPath = logFilePath + ".meta";

      await writeLogFileMetadata(logFilePath);

      const metaExists = await fs
        .stat(metaPath)
        .then(() => true)
        .catch(() => false);
      expect(metaExists).toBe(true);
    });

    it("should write metadata file with custom createdAt timestamp", async () => {
      const customTime = 1609459200000; // 2021-01-01

      await writeLogFileMetadata(logFilePath, customTime);

      const metadata = await readLogFileMetadata(logFilePath);
      expect(metadata.createdAt).toBe(customTime);
    });

    it("should read metadata file correctly", async () => {
      const customTime = Date.now() - 100000;

      await writeLogFileMetadata(logFilePath, customTime);
      const metadata = await readLogFileMetadata(logFilePath);

      expect(metadata.version).toBe(1);
      expect(metadata.createdAt).toBe(customTime);
    });

    it("should ensure metadata file exists, creating if necessary", async () => {
      await createTestFile(logFilePath, 100);

      await ensureMetadataFile(logFilePath);

      const metadata = await readLogFileMetadata(logFilePath);
      expect(metadata.version).toBe(1);
      expect(metadata.createdAt).toBeGreaterThan(0);
    });

    it("should not overwrite existing metadata file", async () => {
      const customTime = 1609459200000;

      await createTestFile(logFilePath, 100);
      await writeLogFileMetadata(logFilePath, customTime);
      await ensureMetadataFile(logFilePath);

      const metadata = await readLogFileMetadata(logFilePath);
      expect(metadata.createdAt).toBe(customTime);
    });

    it("should handle missing log file gracefully when ensuring metadata", async () => {
      // File doesn't exist
      const result = ensureMetadataFile(logFilePath);

      // Should not throw
      await expect(result).resolves.not.toThrow();
    });
  });

  describe("breakDownPath", () => {
    it("should correctly break down a file path", () => {
      const path = join(testDir, "app.log");
      const parts = breakDownPath(path);

      expect(parts.dirname).toBe(testDir);
      expect(parts.basename).toBe("app");
      expect(parts.extname).toBe(".log");
    });

    it("should handle paths with multiple dots", () => {
      const path = join(testDir, "app.backup.log");
      const parts = breakDownPath(path);

      expect(parts.basename).toBe("app.backup");
      expect(parts.extname).toBe(".log");
    });
  });

  describe("shouldRotate", () => {
    it("should return false when file is below size threshold", async () => {
      await createTestFile(logFilePath, 1024 * 1024); // 1 MB
      await writeLogFileMetadata(logFilePath);

      const shouldRotateVal = await shouldRotate({
        logFilePath,
        maxLogAgeDays: 7,
        maxLogSizeMB: 10,
        maxLogRotations: 5,
        runIntervalMs: 100000,
      });

      expect(shouldRotateVal).toBe(false);
    });

    it("should return true when file exceeds size threshold", async () => {
      await createTestFile(logFilePath, 51 * 1024 * 1024); // 51 MB
      await writeLogFileMetadata(logFilePath);

      const shouldRotateVal = await shouldRotate({
        logFilePath,
        maxLogAgeDays: 7,
        maxLogSizeMB: 50,
        maxLogRotations: 5,
        runIntervalMs: 100000,
      });

      expect(shouldRotateVal).toBe(true);
    });

    it("should return false when file is newer than max age", async () => {
      await createTestFile(logFilePath, 100);
      await writeLogFileMetadata(logFilePath, Date.now()); // Just created

      const shouldRotateVal = await shouldRotate({
        logFilePath,
        maxLogAgeDays: 7,
        maxLogSizeMB: 100,
        maxLogRotations: 5,
        runIntervalMs: 100000,
      });

      expect(shouldRotateVal).toBe(false);
    });

    it("should return true when file exceeds age threshold", async () => {
      await createTestFile(logFilePath, 100);
      const eightDaysMs = 8 * 24 * 60 * 60 * 1000;
      const oldTime = Date.now() - eightDaysMs;
      await writeLogFileMetadata(logFilePath, oldTime);

      const shouldRotateVal = await shouldRotate({
        logFilePath,
        maxLogAgeDays: 7,
        maxLogSizeMB: 100,
        maxLogRotations: 5,
        runIntervalMs: 100000,
      });

      expect(shouldRotateVal).toBe(true);
    });

    it("should return false for empty log file", async () => {
      await createTestFile(logFilePath, 0);
      // Should still return false even though the file is old
      await writeLogFileMetadata(logFilePath, Date.now() - 1_000_000);

      const shouldRotateVal = await shouldRotate({
        logFilePath,
        maxLogAgeDays: 7,
        maxLogSizeMB: 50,
        maxLogRotations: 5,
        runIntervalMs: 100000,
      });

      expect(shouldRotateVal).toBe(false);
    });
  });

  describe("rotateLogFile", () => {
    it("should rename the log file with timestamp", async () => {
      await createTestFile(logFilePath);
      await rotateLogFile(logFilePath);

      const files = await fs.readdir(testDir);
      const rotatedFiles = files.filter(
        (f) =>
          f.startsWith("test-") &&
          f.endsWith(".log") &&
          f !== `test-${Date.now()}.log`
      );

      // Should have at least one rotated file with timestamp pattern
      const hasTimestampedFile = rotatedFiles.some((f) =>
        /\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/.test(f)
      );
      expect(hasTimestampedFile).toBe(true);
    });

    it("should recreate log file after rotation", async () => {
      await createTestFile(logFilePath);
      await rotateLogFile(logFilePath);

      const logExists = await fs
        .stat(logFilePath)
        .then(() => true)
        .catch(() => false);
      expect(logExists).toBe(true);

      // Log file + 1 rotated file + meta file
      expect(fs.readdir(testDir)).resolves.toHaveLength(3);
    });

    it("should update log metadata after rotation", async () => {
      await createTestFile(logFilePath);

      const oldDate = Date.now() - 1_000_000;
      await writeLogFileMetadata(logFilePath, oldDate);
      await rotateLogFile(logFilePath);

      const metadata = await readLogFileMetadata(logFilePath);

      expect(metadata.createdAt).toBeGreaterThan(oldDate);
    });
  });

  describe("getRotatedLogFiles", () => {
    it("should identify all rotated log files", async () => {
      const filename = basename(logFilePath);
      const file1 = join(testDir, filename + ".2025-01-01T00-00-00-000Z.log");
      const file2 = join(testDir, filename + ".2025-01-02T00-00-00-000Z.log");
      const file3 = join(testDir, filename + ".2025-01-03T00-00-00-000Z.log");

      await createTestFile(file1, 100);
      await createTestFile(file2, 100);
      await createTestFile(file3, 100);
      await createTestFile(logFilePath, 100);

      const rotatedFiles = await getRotatedLogFiles(logFilePath);

      expect(rotatedFiles.length).toBe(3);
      expect(rotatedFiles).toMatchObject([
        { path: file1 },
        { path: file2 },
        { path: file3 },
      ]);
    });
  });

  describe("cleanupOldRotations", () => {
    it("should delete old rotated files, keeping only maxRotations", async () => {
      const filename = basename(logFilePath);
      // Create 6 rotated files
      for (let i = 1; i <= 6; i++) {
        const rotatedPath = join(
          testDir,
          `${filename}.2025-01-${String(i).padStart(2, "0")}T00-00-00-000Z.log`
        );
        await createTestFile(rotatedPath, 1024);
      }

      await cleanupOldRotations(logFilePath, 3);

      const files = await fs.readdir(testDir);
      const rotatedFiles = files.filter(
        (f) => f.endsWith(".log") && f !== "app.log"
      );

      // Should keep at most maxRotations newest files
      expect(rotatedFiles.length).toBeLessThanOrEqual(3);
    });

    it("should not delete rotated files if under maxRotations", async () => {
      // Create 2 rotated files
      for (let i = 1; i <= 3; i++) {
        const rotatedPath = join(
          testDir,
          `app.2025-01-${String(i).padStart(2, "0")}T00-00-00-000Z.log`
        );
        await createTestFile(rotatedPath, 1024);
      }

      await cleanupOldRotations(logFilePath, 3);

      const files = await fs.readdir(testDir);
      const rotatedFiles = files.filter(
        (f) => f.endsWith(".log") && f !== "app.log"
      );

      // Should keep all 3 rotated files
      expect(rotatedFiles).toHaveLength(3);
    });
  });

  describe("cleanUpOrphanMetadata", () => {
    it("should delete orphaned metadata files", async () => {
      const logPath = join(testDir, "app.log");

      // Create orphaned metadata files (no corresponding log file)
      await fs.writeFile(
        join(testDir, "orphaned1.log.meta"),
        '{"version":1,"createdAt":123}'
      );
      await fs.writeFile(
        join(testDir, "orphaned2.log.meta"),
        '{"version":1,"createdAt":123}'
      );

      // Create one valid pair
      await createTestFile(logPath, 100);
      await writeLogFileMetadata(logPath);

      await cleanUpOrphanMetadata(logFilePath);

      const files = await fs.readdir(testDir);
      const metaFiles = files.filter((f) => f.endsWith(".meta"));

      // Should have deleted orphaned metadata files
      expect(metaFiles).not.toContain("orphaned1.log.meta");
      expect(metaFiles).not.toContain("orphaned2.log.meta");
      expect(metaFiles).toContain("app.log.meta");
    });
  });

  describe("setUpLogRotation", () => {
    it("should set up an interval for periodic checks", async () => {
      await createTestFile(logFilePath, 100);
      await writeLogFileMetadata(logFilePath);

      const config: RotationConfig = {
        logFilePath,
        maxLogAgeDays: 7,
        maxLogSizeMB: 100,
        maxLogRotations: 5,
        runIntervalMs: 50,
      };

      const interval = await setUpLogRotation(config);

      expect(interval).toBeDefined();

      stopLogRotation(interval);
    });

    it("should perform rotation immediately on startup", async () => {
      await createTestFile(logFilePath, 51 * 1024 * 1024);
      await writeLogFileMetadata(logFilePath);

      const config: RotationConfig = {
        logFilePath,
        maxLogAgeDays: 7,
        maxLogSizeMB: 50,
        maxLogRotations: 5,
        runIntervalMs: 100000,
      };

      const interval = await setUpLogRotation(config);
      stopLogRotation(interval);

      const files = await fs.readdir(testDir);
      const rotatedFiles = files.filter((f) =>
        /\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/.test(f)
      );

      expect(rotatedFiles.length).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("should handle missing log file gracefully", async () => {
      const config: RotationConfig = {
        logFilePath,
        maxLogAgeDays: 7,
        maxLogSizeMB: 50,
        maxLogRotations: 5,
        runIntervalMs: 100000,
      };

      const interval = await setUpLogRotation(config);
      stopLogRotation(interval);

      // Should complete without error
      expect(true).toBe(true);
    });

    it("should handle callback errors gracefully", async () => {
      let callbackCalled = false;

      await createTestFile(logFilePath, 51 * 1024 * 1024);
      await writeLogFileMetadata(logFilePath);

      const config: RotationConfig = {
        logFilePath,
        maxLogAgeDays: 7,
        maxLogSizeMB: 50,
        maxLogRotations: 5,
        runIntervalMs: 100000,
        onRotate: () => {
          callbackCalled = true;
          throw new Error("Callback error");
        },
      };

      const interval = await setUpLogRotation(config);
      stopLogRotation(interval);

      // Should handle error without crashing
      expect(callbackCalled).toBe(true);
    });

    it("should correctly handle both rotation triggers simultaneously", async () => {
      const tenDaysAgoMs = 10 * 24 * 60 * 60 * 1000;
      const oldTime = Date.now() - tenDaysAgoMs;

      await createTestFile(logFilePath, 51 * 1024 * 1024); // Size trigger
      await writeLogFileMetadata(logFilePath, oldTime); // Age trigger

      const shouldRotateVal = await shouldRotate({
        logFilePath,
        maxLogAgeDays: 7,
        maxLogSizeMB: 50,
        maxLogRotations: 5,
        runIntervalMs: 100000,
      });

      expect(shouldRotateVal).toBe(true);
    });
  });
});
