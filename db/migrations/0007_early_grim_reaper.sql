ALTER TABLE "activity_read_states" ADD COLUMN "cleared_through_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "activity_read_states" ADD COLUMN "cleared_through_event_id" uuid;