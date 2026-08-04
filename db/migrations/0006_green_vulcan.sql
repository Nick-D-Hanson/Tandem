CREATE TABLE "activity_digest_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"digest_id" uuid NOT NULL,
	"push_subscription_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempted_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_digest_deliveries_status_check" CHECK ("activity_digest_deliveries"."status" in ('pending', 'processing', 'sent', 'expired', 'failed')),
	CONSTRAINT "activity_digest_deliveries_attempt_count_check" CHECK ("activity_digest_deliveries"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "activity_digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"recipient_user_id" text NOT NULL,
	"digest_date" date NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"relevant_activity_count" integer DEFAULT 0 NOT NULL,
	"assigned_to_recipient_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_digests_status_check" CHECK ("activity_digests"."status" in ('processing', 'no_activity', 'sent', 'partial', 'failed')),
	CONSTRAINT "activity_digests_activity_count_check" CHECK ("activity_digests"."relevant_activity_count" >= 0),
	CONSTRAINT "activity_digests_assigned_count_check" CHECK ("activity_digests"."assigned_to_recipient_count" >= 0),
	CONSTRAINT "activity_digests_window_check" CHECK ("activity_digests"."window_end" > "activity_digests"."window_start")
);
--> statement-breakpoint
ALTER TABLE "activity_digest_deliveries" ADD CONSTRAINT "activity_digest_deliveries_digest_id_activity_digests_id_fk" FOREIGN KEY ("digest_id") REFERENCES "public"."activity_digests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_digest_deliveries" ADD CONSTRAINT "activity_digest_deliveries_push_subscription_id_push_subscriptions_id_fk" FOREIGN KEY ("push_subscription_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_digests" ADD CONSTRAINT "activity_digests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_digest_deliveries_digest_subscription_unique" ON "activity_digest_deliveries" USING btree ("digest_id","push_subscription_id");--> statement-breakpoint
CREATE INDEX "activity_digest_deliveries_digest_status_idx" ON "activity_digest_deliveries" USING btree ("digest_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_digests_workspace_recipient_date_unique" ON "activity_digests" USING btree ("workspace_id","recipient_user_id","digest_date");--> statement-breakpoint
CREATE INDEX "activity_digests_date_status_idx" ON "activity_digests" USING btree ("digest_date","status");