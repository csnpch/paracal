CREATE TABLE "event_notification_deliveries" (
  "id" SERIAL PRIMARY KEY,
  "event_id" INTEGER NOT NULL REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "webhook_key" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'claimed',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "event_notification_deliveries_event_id_webhook_key_key" ON "event_notification_deliveries"("event_id", "webhook_key");
