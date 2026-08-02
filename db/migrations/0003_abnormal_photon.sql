CREATE TABLE "agenda_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"owner_user_id" text NOT NULL,
	"agenda_date" date NOT NULL,
	"content" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agenda_items_content_check" CHECK (length(btrim("agenda_items"."content")) between 1 and 300),
	CONSTRAINT "agenda_items_position_check" CHECK ("agenda_items"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "agenda_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"visible_days" integer DEFAULT 3 NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agenda_preferences_visible_days_check" CHECK ("agenda_preferences"."visible_days" between 1 and 3)
);
--> statement-breakpoint
ALTER TABLE "agenda_items" ADD CONSTRAINT "agenda_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_preferences" ADD CONSTRAINT "agenda_preferences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agenda_items_owner_date_position_idx" ON "agenda_items" USING btree ("workspace_id","owner_user_id","agenda_date","position");--> statement-breakpoint
CREATE UNIQUE INDEX "agenda_preferences_workspace_user_unique" ON "agenda_preferences" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "agenda_preferences_workspace_user_idx" ON "agenda_preferences" USING btree ("workspace_id","user_id");