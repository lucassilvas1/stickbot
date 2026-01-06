import { initDb } from "./db.js";
import {
  _deleteSticker,
  _deleteUserPermissions,
  _getStickerById,
  _getStickerByTitle,
  _getUserPermissionsById,
  _getUsers,
  _incrementStickerUsage,
  _insertSticker,
  _insertUserPermissions,
  _updateSticker,
  _updateUserPermissions,
} from "./crud.js";
import { _search } from "./search.js";
import type { Kysely } from "kysely";
import type { Database } from "../types/db.js";

let hasInit = false;
let promise: Promise<Kysely<Database>> | null;
let db: Kysely<Database>;

async function getDb() {
  if (!hasInit) {
    if (!promise) promise = initDb();
    db = await promise;
    hasInit = true;
    promise = null;
  }
  return db;
}

function withDb<F extends (db: Kysely<Database>, ...args: any[]) => any>(
  fn: F
) {
  return async (
    ...args: Parameters<F> extends [any, ...infer Rest] ? Rest : never
  ): Promise<Awaited<ReturnType<F>>> => {
    const db = await getDb();
    return fn(db, ...args);
  };
}

export const insertUserPermissions = withDb(_insertUserPermissions);
export const getUserPermissionsById = withDb(_getUserPermissionsById);
export const updatedUserPermissions = withDb(_updateUserPermissions);
export const deleteUserPermissions = withDb(_deleteUserPermissions);
export const getUsers = withDb(_getUsers);
export const insertSticker = withDb(_insertSticker);
export const incrementStickerUsage = withDb(_incrementStickerUsage);
export const updateSticker = withDb(_updateSticker);
export const deleteSticker = withDb(_deleteSticker);
export const search = withDb(_search);
export const getStickerByTitle = withDb(_getStickerByTitle);

export function getStickerById(id: string): ReturnType<typeof _getStickerById>;
export function getStickerById(
  id: string,
  incrementUsage: true,
  userId: string
): ReturnType<typeof _getStickerById>;
export async function getStickerById(
  id: string,
  incrementUsage?: boolean,
  userId?: string
) {
  const db = await getDb();
  return _getStickerById(db, id, incrementUsage, userId);
}
