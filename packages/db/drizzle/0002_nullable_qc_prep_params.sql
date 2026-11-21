ALTER TABLE "sample_rows" ALTER COLUMN "weight" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "sample_rows" ALTER COLUMN "volume" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "sample_rows" ALTER COLUMN "df" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "sample_rows" DROP CONSTRAINT IF EXISTS "sample_rows_df_positive";
--> statement-breakpoint
DROP TRIGGER IF EXISTS sample_rows_no_update ON sample_rows;
--> statement-breakpoint
UPDATE "sample_rows"
SET "weight" = NULL, "volume" = NULL, "df" = NULL
WHERE "sample_type" IN ('blank_method', 'ccv');
--> statement-breakpoint
CREATE TRIGGER sample_rows_no_update
    BEFORE UPDATE ON sample_rows
    FOR EACH ROW
    EXECUTE FUNCTION valid_ex_reject_mutation();
--> statement-breakpoint
ALTER TABLE "sample_rows"
  ADD CONSTRAINT "sample_rows_prep_params_by_type_chk"
  CHECK (
    ("sample_type" IN ('blank_method', 'ccv') AND "weight" IS NULL AND "volume" IS NULL AND "df" IS NULL)
    OR
    ("sample_type" IN ('sample', 'spike', 'duplicate') AND "weight" IS NOT NULL AND "weight" > 0 AND "volume" IS NOT NULL AND "volume" > 0 AND "df" IS NOT NULL AND "df" > 0)
  );
