import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "../../../db/schema";

function databaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not configured");
  return value;
}

const sql = neon(databaseUrl());

export const db = drizzle({ client: sql, schema });
export { sql as neonSql };
