ALTER TABLE "cronjob_config" ADD COLUMN "daily_leader_enabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "daily_rotation_config" (
  "id" INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "notification_enabled" BOOLEAN NOT NULL DEFAULT false,
  "notification_time" TEXT NOT NULL DEFAULT '09:00',
  "start_week" TEXT NOT NULL,
  "employee_order" JSONB NOT NULL DEFAULT '[]'
);
CREATE TABLE "daily_meeting_weeks" (
  "week_start" TEXT PRIMARY KEY,
  "date" TEXT NOT NULL,
  "employee_id" INTEGER,
  "employee_name" TEXT
);
CREATE TABLE "daily_leader_deliveries" (
  "id" SERIAL PRIMARY KEY,
  "week_start" TEXT NOT NULL,
  "webhook_key" TEXT NOT NULL,
  "config_id" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'claimed',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "daily_leader_deliveries_week_start_webhook_key_key" ON "daily_leader_deliveries" ("week_start", "webhook_key");
