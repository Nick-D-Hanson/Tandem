ALTER TABLE "tasks" ADD COLUMN "scheduled_date" date;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "quadrant" integer;--> statement-breakpoint
CREATE INDEX "tasks_workspace_scheduled_position_idx" ON "tasks" USING btree ("workspace_id","scheduled_date","position");--> statement-breakpoint
CREATE INDEX "tasks_workspace_quadrant_position_idx" ON "tasks" USING btree ("workspace_id","quadrant","position");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_quadrant_check" CHECK ("tasks"."quadrant" is null or "tasks"."quadrant" between 1 and 4);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_position_check" CHECK ("tasks"."position" >= 0);