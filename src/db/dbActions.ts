import { initDb } from "./db.js";
import {
  _deleteSticker,
  _deleteUserPermissions,
  _getStickerById,
  _getUserPermissionsById,
  _incrementStickerUsage,
  _insertSticker,
  _insertUserPermissions,
  _updateSticker,
  _updateUserPermissions,
} from "./crud.js";
import { _search } from "./search.js";

export const db = await initDb();

export const insertUserPermissions = bindDbFunction(db, _insertUserPermissions);

export const getUserPermissionsById = bindDbFunction(
  db,
  _getUserPermissionsById
);

export const updatedUserPermissions = bindDbFunction(
  db,
  _updateUserPermissions
);
export const deleteUserPermissions = bindDbFunction(db, _deleteUserPermissions);

export const insertSticker = bindDbFunction(db, _insertSticker);

export const incrementStickerUsage = bindDbFunction(db, _incrementStickerUsage);

export function getStickerById(id: string): ReturnType<typeof _getStickerById>;
export function getStickerById(
  id: string,
  incrementUsage: true,
  userId: string
): ReturnType<typeof _getStickerById>;
export function getStickerById(
  id: string,
  incrementUsage?: boolean,
  userId?: string
) {
  return _getStickerById(db, id, incrementUsage as any, userId as any);
}

export const updateSticker = bindDbFunction(db, _updateSticker);

export const deleteSticker = bindDbFunction(db, _deleteSticker);

export const search = bindDbFunction(db, _search);

type ShiftTuple<T extends any[]> = T extends [any, ...infer Rest]
  ? Rest
  : never;

export function bindDbFunction<F extends (db: any, ...args: any[]) => any>(
  db: Parameters<F>[0],
  fn: F
): (...args: ShiftTuple<Parameters<F>>) => ReturnType<F> {
  return (...args: any[]) => fn(db, ...args);
}
