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

describe("Activity ledger migration", () => {
  const migration = readFileSync(new URL("../db/migrations/0004_useful_inertia.sql", import.meta.url), "utf8");

  it("keeps entity IDs as immutable references without item foreign keys", () => {
    expect(migration).toContain('"entity_id" uuid NOT NULL');
    expect(migration).not.toContain("activity_events_entity_id_tasks");
    expect(migration).not.toContain("activity_events_entity_id_events");
  });

  it("enforces activity values and deterministic feed indexes", () => {
    expect(migration).toContain("activity_events_entity_type_check");
    expect(migration).toContain("activity_events_action_type_check");
    expect(migration).toContain('"occurred_at" DESC');
    expect(migration).toContain("activity_read_states_workspace_user_unique");
  });
});

describe("Push subscription migration", () => {
  const migration = readFileSync(new URL("../db/migrations/0005_bored_matthew_murdock.sql", import.meta.url), "utf8");

  it("keeps a browser endpoint globally unique and tied to its workspace", () => {
    expect(migration).toContain('CREATE UNIQUE INDEX "push_subscriptions_endpoint_unique"');
    expect(migration).toContain('FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade');
  });

  it("supports scoped enabled-subscription lookups and failure bookkeeping", () => {
    expect(migration).toContain('"workspace_id","user_id","enabled"');
    expect(migration).toContain('CHECK ("push_subscriptions"."failure_count" >= 0)');
  });
});

describe("Daily digest migration", () => {
  const migration = readFileSync(new URL("../db/migrations/0006_green_vulcan.sql", import.meta.url), "utf8");

  it("enforces one digest per recipient and Central date", () => {
    expect(migration).toContain('CREATE UNIQUE INDEX "activity_digests_workspace_recipient_date_unique"');
    expect(migration).toContain('("workspace_id","recipient_user_id","digest_date")');
  });

  it("enforces one durable delivery per digest and device", () => {
    expect(migration).toContain('CREATE UNIQUE INDEX "activity_digest_deliveries_digest_subscription_unique"');
    expect(migration).toContain('("digest_id","push_subscription_id")');
    expect(migration).toContain("'pending', 'processing', 'sent', 'expired', 'failed'");
  });
});

describe("Activity clear watermark migration", () => {
  const migration = readFileSync(new URL("../db/migrations/0007_early_grim_reaper.sql", import.meta.url), "utf8");

  it("adds a private timestamp and deterministic event-ID clear watermark", () => {
    expect(migration).toContain('ADD COLUMN "cleared_through_at" timestamp with time zone');
    expect(migration).toContain('ADD COLUMN "cleared_through_event_id" uuid');
  });
});

describe("Native push device migration", () => {
  const migration = readFileSync(new URL("../db/migrations/0008_abnormal_gertrude_yorkes.sql", import.meta.url), "utf8");

  it("separates native tokens from browser VAPID subscriptions and scopes installations", () => {
    expect(migration).toContain('CREATE TABLE "native_push_devices"');
    expect(migration).toContain('CREATE UNIQUE INDEX "native_push_devices_workspace_user_device_unique"');
    expect(migration).toContain('CREATE UNIQUE INDEX "native_push_devices_token_unique"');
    expect(migration).toContain('CHECK ("native_push_devices"."platform" in (\'ios\'))');
  });
});
