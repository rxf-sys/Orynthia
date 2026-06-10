-- externalId ist je Konto eindeutig, nicht global: verschiedene Banken können
-- identische Transaktions-IDs vergeben, was den Sync global-unique brechen würde.
DROP INDEX IF EXISTS "transactions_external_id_key";
CREATE UNIQUE INDEX "transactions_bank_account_id_external_id_key"
  ON "transactions"("bank_account_id", "external_id");

-- Benachrichtigungs-Einstellungen werden serverseitig persistiert (vorher nur Client-State).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notification_settings" JSONB;
