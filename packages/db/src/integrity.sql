CREATE OR REPLACE FUNCTION valid_ex_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'valid-ex: table % forbids %', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_logs_append_only
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION valid_ex_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER qc_criteria__profiles_immutable
    BEFORE UPDATE OR DELETE ON qc_criteria_profiles
    FOR EACH ROW
    EXECUTE FUNCTION valid_ex_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER calibration_no_update
    BEFORE UPDATE ON calibrations
    FOR EACH ROW
    EXECUTE FUNCTION valid_ex_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER sample_rows_no_update
    BEFORE UPDATE ON sample_rows
    FOR EACH ROW
    EXECUTE FUNCTION valid_ex_reject_mutation();