import type { Kysely } from "kysely";
import type { Database } from "../types/db.js";

type DBFunctions = typeof import("./crud.js") & typeof import("./search.js");

/**
 * Shifts the `db` parameter of the crud functions,
 * leaves the rest of the parameters
 */
type WithDB<F> = F extends (db: any, ...args: infer Rest) => infer R
  ? (...args: Rest) => R
  : never;

export type BoundDBFunctions<Module = DBFunctions> = {
  [K in keyof Module as Module[K] extends (...args: any[]) => any
    ? K
    : never]: WithDB<Module[K]>;
};

function withDb<F extends (db: Kysely<Database>, ...args: any[]) => any>(
  db: Kysely<Database>,
  fn: F
) {
  return ((...args: any) => fn(db, ...args)) as WithDB<F>;
}

export function bindDbFunctions(
  db: Kysely<Database>,
  functions: DBFunctions
): BoundDBFunctions<typeof functions> {
  const bound = {} as any;

  for (const [name, fn] of Object.entries(functions)) {
    bound[name] = withDb(db, fn);
  }

  return bound;
}
