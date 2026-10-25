CREATE TABLE "native_push_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"device_id" uuid NOT NULL,
	"expo_push_token" text NOT NULL,
	"platform" text DEFAULT 'ios' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_successful_delivery_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "native_push_devices_platform_check" CHECK ("native_push_devices"."platform" in ('ios')),
	CONSTRAINT "native_push_devices_failure_count_check" CHECK ("native_push_devices"."failure_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "native_push_devices" ADD CONSTRAINT "native_push_devices_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "native_push_devices_workspace_user_device_unique" ON "native_push_devices" USING btree ("workspace_id","user_id","device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "native_push_devices_token_unique" ON "native_push_devices" USING btree ("expo_push_token");--> statement-breakpoint
CREATE INDEX "native_push_devices_workspace_user_enabled_idx" ON "native_push_devices" USING btree ("workspace_id","user_id","enabled");