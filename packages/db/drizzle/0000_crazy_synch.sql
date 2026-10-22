CREATE TYPE "public"."auth_provider" AS ENUM('local', 'google');--> statement-breakpoint
CREATE TYPE "public"."input_mode" AS ENUM('raw_signal', 'in_vial_concentration');--> statement-breakpoint
CREATE TYPE "public"."instrument_type" AS ENUM('ICP-MS', 'ICP-OES', 'AAS', 'HPLC', 'GC-MS');--> statement-breakpoint
CREATE TYPE "public"."qc_status" AS ENUM('PASSED', 'INVALID_QC');--> statement-breakpoint
CREATE TYPE "public"."sample_type" AS ENUM('sample', 'blank_method', 'ccv', 'spike', 'duplicate');--> statement-breakpoint
CREATE TYPE "public"."solution_conc_unit" AS ENUM('ppm', 'ppb', 'ppt');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" uuid NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calibrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"instrument" "instrument_type" NOT NULL,
	"input_mode" "input_mode" NOT NULL,
	"units" jsonb NOT NULL,
	"qc_profile" uuid NOT NULL,
	"qc_profile_version" integer NOT NULL,
	"qc_profile_snapshot" jsonb NOT NULL,
	"qc_status" "qc_status" NOT NULL,
	"analytes" text[] NOT NULL,
	"points" jsonb NOT NULL,
	"analytes_summary" jsonb NOT NULL,
	"qc_violations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calibrations_id_user_uq" UNIQUE("id","user_id"),
	CONSTRAINT "calibrations_analyte_nonempty" CHECK (cardinality("calibrations"."analytes") >= 1),
	CONSTRAINT "calibrations_points_are_array" CHECK (jsonb_typeof("calibrations"."points") = 'array'),
	CONSTRAINT "calibrations_qc_profile_version_positive" CHECK ("calibrations"."qc_profile_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "sample_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calibration_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"lab_sample_id" varchar(255),
	"sample_id" varchar(255) NOT NULL,
	"sample_type" "sample_type" NOT NULL,
	"parent_sample_id" varchar(255),
	"weight" double precision NOT NULL,
	"volume" double precision NOT NULL,
	"df" double precision NOT NULL,
	"spike_added" jsonb,
	"expected_conc" jsonb,
	"readings" jsonb NOT NULL,
	"analyte_results" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sample_rows_calibration_sample_id_uq" UNIQUE("calibration_id","sample_id"),
	CONSTRAINT "sample_rows_lab_sample_id_trimmed_nonempty" CHECK ("sample_rows"."lab_sample_id" IS NULL OR (length(btrim("sample_rows"."lab_sample_id")) > 0 AND "sample_rows"."lab_sample_id" = btrim("sample_rows"."lab_sample_id"))),
	CONSTRAINT "sample_rows_df_positive" CHECK ("sample_rows"."df" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"password_hash" text,
	"avatar_url" text,
	"auth_provider" "auth_provider" DEFAULT 'local' NOT NULL,
	"google_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id"),
	CONSTRAINT "check_provider_identity" CHECK (
       ("users"."auth_provider" = 'local' AND "users"."password_hash" IS NOT NULL AND "users"."google_id" IS NULL) OR
        ("users"."auth_provider" = 'google' AND "users"."google_id" IS NOT NULL AND "users"."password_hash" IS NULL)),
	CONSTRAINT "check_email_lowercase" CHECK (LOWER("users"."email") = "users"."email")
);
--> statement-breakpoint
CREATE TABLE "qc_criteria_profiles" (
	"id" uuid NOT NULL,
	"version" integer NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"method_ref" text NOT NULL,
	"effective_date" date NOT NULL,
	"solution_conc_unit" "solution_conc_unit",
	"linearity_min_r" double precision NOT NULL,
	"analytes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qc_criteria_profiles_id_version_pk" PRIMARY KEY("id","version"),
	CONSTRAINT "qc_profile_owner_name_version_uq" UNIQUE("owner_user_id","name","version"),
	CONSTRAINT "qc_profile_owner_id_version_uq" UNIQUE("owner_user_id","id","version"),
	CONSTRAINT "qc_profiles_version_positive" CHECK ("qc_criteria_profiles"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "calibrations" ADD CONSTRAINT "calibrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "calibrations" ADD CONSTRAINT "calibrations_qc_profile_version_fk" FOREIGN KEY ("user_id","qc_profile","qc_profile_version") REFERENCES "public"."qc_criteria_profiles"("owner_user_id","id","version") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sample_rows" ADD CONSTRAINT "sample_rows_calibration_user_fk" FOREIGN KEY ("calibration_id","user_id") REFERENCES "public"."calibrations"("id","user_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "qc_criteria_profiles" ADD CONSTRAINT "qc_criteria_profiles_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_created_idx" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "calibrations_owner_created_idx" ON "calibrations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "calibrations_owner_instrument_idx" ON "calibrations" USING btree ("user_id","instrument");--> statement-breakpoint
CREATE INDEX "calibrations_owner_qc_status_idx" ON "calibrations" USING btree ("user_id","qc_status");--> statement-breakpoint
CREATE INDEX "sample_rows_calibration_id_idx" ON "sample_rows" USING btree ("calibration_id");--> statement-breakpoint
CREATE INDEX "sample_rows_owner_lab_sample_id_idx" ON "sample_rows" USING btree ("user_id","lab_sample_id") WHERE "sample_rows"."lab_sample_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "qc_profile_owner_name_idx" ON "qc_criteria_profiles" USING btree ("owner_user_id","name");