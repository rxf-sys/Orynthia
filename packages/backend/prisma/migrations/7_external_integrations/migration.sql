-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('GOOGLE_CALENDAR', 'ICS', 'APPLE_CALDAV');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTED', 'ERROR', 'REVOKED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CALENDAR_SYNC_ERROR';

-- AlterTable
ALTER TABLE "calendars" ADD COLUMN     "integration_id" TEXT,
ADD COLUMN     "sync_token" TEXT;

-- CreateTable
CREATE TABLE "external_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "label" TEXT,
    "credential_enc" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'CONNECTED',
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_integrations_user_id_idx" ON "external_integrations"("user_id");

-- CreateIndex
CREATE INDEX "calendars_integration_id_idx" ON "calendars"("integration_id");

-- AddForeignKey
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "external_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_integrations" ADD CONSTRAINT "external_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

