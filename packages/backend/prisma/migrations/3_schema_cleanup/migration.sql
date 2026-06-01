-- Drop ungenutztes Boolean-Feld (redundant zu recurring_payment_id)
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "is_recurring";

-- Index für Income/Expense-Filter auf Transaction.type
CREATE INDEX IF NOT EXISTS "transactions_type_idx" ON "transactions"("type");

-- Index für System-/User-Kategorien-Filter
CREATE INDEX IF NOT EXISTS "categories_user_id_idx" ON "categories"("user_id");
