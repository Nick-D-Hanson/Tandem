import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Agenda migration defaults", () => {
  const migration = readFileSync(new URL("../db/migrations/0003_abnormal_photon.sql", import.meta.url), "utf8");

  it("keeps all new and existing member Agendas private by default", () => {
    expect(migration).toContain('"is_shared" boolean DEFAULT false NOT NULL');
    expect(migration).toContain('"visible_days" integer DEFAULT 3 NOT NULL');
  });

  it("enforces content, horizon, and non-negative ordering constraints", () => {
    expect(migration).toContain('CHECK (length(btrim("agenda_items"."content")) between 1 and 300)');
    expect(migration).toContain('CHECK ("agenda_items"."position" >= 0)');
    expect(migration).toContain('CHECK ("agenda_preferences"."visible_days" between 1 and 3)');
  });
});
