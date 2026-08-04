import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import * as schema from "../../../db/schema";
import { databaseUrl } from "@/lib/db/client";

neonConfig.webSocketConstructor = ws;

function transactionDatabase(pool: Pool) {
  return drizzle({ client: pool, schema });
}

type TransactionDatabase = ReturnType<typeof transactionDatabase>;
export type DatabaseTransaction = Parameters<Parameters<TransactionDatabase["transaction"]>[0]>[0];

export async function withDatabaseTransaction<T>(callback: (transaction: DatabaseTransaction) => Promise<T>) {
  const pool = new Pool({ connectionString: databaseUrl() });
  const transactionDb = transactionDatabase(pool);

  try {
    return await transactionDb.transaction(callback);
  } finally {
    await pool.end();
  }
}
