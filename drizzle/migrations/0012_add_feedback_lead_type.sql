ALTER TYPE "public"."lead_type" ADD VALUE IF NOT EXISTS 'feedback';--> statement-breakpoint
ALTER TYPE "public"."lead_connected_choice" ADD VALUE IF NOT EXISTS 'feedbacked';--> statement-breakpoint
ALTER TYPE "public"."lead_connected_choice" ADD VALUE IF NOT EXISTS 'didnt_feedback';
