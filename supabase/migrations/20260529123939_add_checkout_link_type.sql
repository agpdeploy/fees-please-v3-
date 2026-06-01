ALTER TABLE "public"."transactions" DROP CONSTRAINT "transactions_type_check";
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_type_check" CHECK (transaction_type IN ('payment', 'fee', 'expense', 'checkout_link'));
