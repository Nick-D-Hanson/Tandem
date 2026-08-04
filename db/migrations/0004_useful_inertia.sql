CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_user_id" text NOT NULL,
	"actor_display_name" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_title" text NOT NULL,
	"action_type" text NOT NULL,
	"details" jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_events_entity_type_check" CHECK ("activity_events"."entity_type" in ('task', 'event')),
	CONSTRAINT "activity_events_action_type_check" CHECK ("activity_events"."action_type" in ('created', 'completed', 'reopened', 'deleted', 'updated'))
);
--> statement-breakpoint
CREATE TABLE "activity_read_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_seen_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_read_states" ADD CONSTRAINT "activity_read_states_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_events_workspace_occurred_idx" ON "activity_events" USING btree ("workspace_id","occurred_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "activity_events_workspace_actor_occurred_idx" ON "activity_events" USING btree ("workspace_id","actor_user_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "activity_read_states_workspace_user_unique" ON "activity_read_states" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "activity_read_states_workspace_user_idx" ON "activity_read_states" USING btree ("workspace_id","user_id");