ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "list_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_list_id_task_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."task_lists"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_workspace_list_idx" ON "events" USING btree ("workspace_id","list_id");--> statement-breakpoint
UPDATE "events" AS event
SET "list_id" = (
  SELECT "id"
  FROM "task_lists"
  WHERE "workspace_id" = event."workspace_id"
    AND lower("color") = CASE lower(event."color")
      WHEN 'blue' THEN '#2563eb'
      WHEN 'teal' THEN '#0f766e'
      WHEN 'amber' THEN '#d97706'
      WHEN 'violet' THEN '#7c3aed'
      WHEN 'rose' THEN '#db2777'
      ELSE lower(event."color")
    END
  ORDER BY "position", "created_at"
  LIMIT 1
)
WHERE event."list_id" IS NULL;
