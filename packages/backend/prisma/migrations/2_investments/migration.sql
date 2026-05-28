-- CreateEnum
CREATE TYPE "InvestmentType" AS ENUM ('STOCK', 'ETF', 'FUND', 'CRYPTO', 'BOND', 'OTHER');

-- CreateTable
CREATE TABLE "investment_positions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bank_account_id" TEXT,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InvestmentType" NOT NULL DEFAULT 'STOCK',
    "quantity" DECIMAL(20,8) NOT NULL,
    "average_price" DECIMAL(20,8) NOT NULL,
    "current_price" DECIMAL(20,8),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "purchase_date" TIMESTAMP(3),
    "last_price_update" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_positions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investment_positions_user_id_idx" ON "investment_positions"("user_id");

-- CreateIndex
CREATE INDEX "investment_positions_user_id_type_idx" ON "investment_positions"("user_id", "type");

-- AddForeignKey
ALTER TABLE "investment_positions" ADD CONSTRAINT "investment_positions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_positions" ADD CONSTRAINT "investment_positions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
