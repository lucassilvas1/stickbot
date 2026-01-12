import { promises as fs } from "fs";
import { join, dirname, basename, extname } from "path";
import { getFileInfo } from "../utils/misc.js";
import z from "zod";
import { isSystemError } from "../utils/error.js";

export type RotationConfig = {
  logFilePath: string;
  maxLogAgeDays: number;
  maxLogSizeMB: number;
  maxLogRotations: number;
  runIntervalMs: number;
  onRotate?: () => any;
};

const LogFileMetadataSchema = z.object({
  version: z.number(),
  createdAt: z.number(),
});
const META_FILE_VERSION = 1;
const META_FILE_EXTNAME = ".meta";

function getMetadataFilePath(logFilePath: string) {
  return logFilePath + META_FILE_EXTNAME;
}

function isMetadataFile(filename: string) {
  return filename.endsWith(META_FILE_EXTNAME);
}

export function writeLogFileMetadata(
  logFilePath: string,
  createdAt = Date.now()
) {
  const meta = { version: META_FILE_VERSION, createdAt };
  const path = getMetadataFilePath(logFilePath);
  return fs.writeFile(path, JSON.stringify(meta));
}

export function breakDownPath(path: string) {
  const ext = extname(path);

  return {
    dirname: dirname(path),
    basename: basename(path, ext),
    extname: ext,
  };
}

export async function readLogFileMetadata(logFilePath: string) {
  const path = getMetadataFilePath(logFilePath);
  const string = await fs.readFile(path, { encoding: "utf-8" });
  const object = JSON.parse(string);
  return LogFileMetadataSchema.parse(object);
}

export async function ensureMetadataFile(path: string) {
  try {
    await readLogFileMetadata(path);
  } catch (error) {
    // Happens the first time
    if (isSystemError(error) && error.code === "ENOENT") {
      const fileInfo = await getFileInfo(path);
      // Log file doesn't exist
      if (!fileInfo) return;
      // Use birthTime as a fallback
      await writeLogFileMetadata(path, fileInfo.birthTime);
    } else throw error; // Other errors are likely unrecoverable, better to bubble
  }
}

async function shouldRotateBySize(sizeMB: number, maxSizeMB: number) {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return sizeMB >= maxSizeBytes;
}

async function shouldRotateByAge(
  logFilePath: string,
  maxAgeDays: number
): Promise<boolean> {
  const metadata = await readLogFileMetadata(logFilePath);
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const ageMs = Date.now() - metadata.createdAt;
  return ageMs >= maxAgeMs;
}

export async function rotateLogFile(logFilePath: string) {
  const { dirname, basename, extname } = breakDownPath(logFilePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rotatedPath = join(dirname, `${basename}.${timestamp}${extname}`);

  try {
    await fs.rename(logFilePath, rotatedPath);
    // Immediately recreate log file to avoid metadata file being cleaned up
    // by mistake
    await writeLogFileMetadata(logFilePath);
    await fs.writeFile(logFilePath, "");
  } catch (error) {
    console.error(`Failed to rotate log file: ${error}`);
    throw error;
  }

  return rotatedPath;
}

export async function getRotatedLogFiles(logFilePath: string) {
  const { dirname, basename, extname } = breakDownPath(logFilePath);

  try {
    const files = await fs.readdir(dirname);
    const rotatedFiles = [];

    for (const file of files) {
      if (
        file.startsWith(basename) &&
        file.endsWith(extname) &&
        file !== basename + extname
      ) {
        const fullPath = join(dirname, file);
        const info = await getFileInfo(fullPath);
        if (info) {
          rotatedFiles.push(info);
        }
      }
    }

    return rotatedFiles.sort((a, b) => a.birthTime - b.birthTime);
  } catch {
    return [];
  }
}

export async function cleanupOldRotations(
  logFilePath: string,
  maxRotations: number
): Promise<void> {
  const rotatedFiles = await getRotatedLogFiles(logFilePath);

  if (rotatedFiles.length > maxRotations) {
    const filesToDelete = rotatedFiles.slice(maxRotations);

    for (const file of filesToDelete) {
      try {
        await fs.unlink(file.path);
      } catch (error) {
        console.error(
          `Failed to delete old log file at "${file.path}": ${error}`
        );
      }
    }
  }
}

export async function cleanUpOrphanMetadata(logFilePath: string) {
  const { dirname } = breakDownPath(logFilePath);

  const files = await fs.readdir(dirname);
  for (const file of files) {
    if (!isMetadataFile(file)) continue;

    const logFile = basename(file, META_FILE_EXTNAME);
    if (files.includes(logFile)) continue;

    const path = join(dirname, file);
    try {
      await fs.unlink(path);
    } catch (error) {
      console.error(
        `Failed to delete unused log metadata file at "${path}": ${error}`
      );
    }
  }
}

export async function shouldRotate(config: RotationConfig): Promise<boolean> {
  const fileInfo = await getFileInfo(config.logFilePath);
  // Missing or empty
  if (!fileInfo?.size) return false;
  const tooLarge = await shouldRotateBySize(fileInfo.size, config.maxLogSizeMB);
  if (tooLarge) return true;
  return shouldRotateByAge(config.logFilePath, config.maxLogAgeDays);
}

async function performRotation(config: RotationConfig) {
  await ensureMetadataFile(config.logFilePath);
  try {
    if (await shouldRotate(config)) {
      await rotateLogFile(config.logFilePath);
      if (config.onRotate) {
        try {
          // Ignore callback errors
          await config.onRotate();
        } catch {}
      }
    }

    await Promise.all([
      cleanupOldRotations(config.logFilePath, config.maxLogRotations),
      cleanUpOrphanMetadata(config.logFilePath),
    ]);
  } catch (error) {
    console.error(`Log rotation failed: ${error}`);
  }
}

export async function setUpLogRotation(config: RotationConfig) {
  const interval = setInterval(() => {
    performRotation(config).catch(console.error);
  }, config.runIntervalMs);

  try {
    // Perform rotation immediately on startup
    await performRotation(config);
  } catch (error) {
    console.error(error);
  }

  return interval;
}

export function stopLogRotation(interval: NodeJS.Timeout) {
  clearInterval(interval);
}
