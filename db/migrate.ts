import { config } from "dotenv";
import { migrate } from "drizzle-orm/neon-http/migrator";

config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/lib/db/client");
  await migrate(db, { migrationsFolder: "db/migrations" });
  console.log("Tandem database migrations applied.");
}

main().catch((error) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
