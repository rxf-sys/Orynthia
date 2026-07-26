-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('PLANNED', 'ONGOING', 'DONE');

-- CreateEnum
CREATE TYPE "LinkableType" AS ENUM ('TRIP', 'CALENDAR_EVENT', 'TASK', 'LIST', 'NOTE', 'RECIPE');

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "color" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "destination" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "budget_amount" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "TripStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_links" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_type" "LinkableType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "target_type" "LinkableType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notes_user_id_pinned_idx" ON "notes"("user_id", "pinned");

-- CreateIndex
CREATE INDEX "notes_user_id_updated_at_idx" ON "notes"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "trips_user_id_start_date_idx" ON "trips"("user_id", "start_date");

-- CreateIndex
CREATE INDEX "entity_links_user_id_source_type_source_id_idx" ON "entity_links"("user_id", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "entity_links_user_id_target_type_target_id_idx" ON "entity_links"("user_id", "target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "entity_links_user_id_source_type_source_id_target_type_targ_key" ON "entity_links"("user_id", "source_type", "source_id", "target_type", "target_id");

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

