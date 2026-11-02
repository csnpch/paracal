ALTER TABLE "daily_rotation_config" ADD COLUMN "skipped_employee_ids" JSONB NOT NULL DEFAULT '[]';
