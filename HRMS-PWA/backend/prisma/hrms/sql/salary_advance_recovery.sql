ALTER TABLE "SalaryAdvance" ADD COLUMN IF NOT EXISTS "requestType" TEXT DEFAULT 'SALARY_ADVANCE';
ALTER TABLE "SalaryAdvance" ADD COLUMN IF NOT EXISTS "approvedAmount" TEXT;
ALTER TABLE "SalaryAdvance" ADD COLUMN IF NOT EXISTS "repaymentType" TEXT;
ALTER TABLE "SalaryAdvance" ADD COLUMN IF NOT EXISTS "deductionStartPeriod" TEXT;
ALTER TABLE "SalaryAdvance" ADD COLUMN IF NOT EXISTS "instalmentCount" INTEGER;
ALTER TABLE "SalaryAdvance" ADD COLUMN IF NOT EXISTS "instalmentAmount" TEXT;
ALTER TABLE "SalaryAdvance" ADD COLUMN IF NOT EXISTS "disbursedAmount" TEXT;
ALTER TABLE "SalaryAdvance" ADD COLUMN IF NOT EXISTS "disbursementDate" TIMESTAMP(3);
ALTER TABLE "SalaryAdvance" ADD COLUMN IF NOT EXISTS "paymentReference" TEXT;
ALTER TABLE "SalaryAdvance" ADD COLUMN IF NOT EXISTS "recoveredAmount" TEXT;
ALTER TABLE "SalaryAdvance" ADD COLUMN IF NOT EXISTS "outstandingBalance" TEXT;

ALTER TABLE "SalaryAdvanceRepayment" ADD COLUMN IF NOT EXISTS "periodLabel" TEXT;
ALTER TABLE "SalaryAdvanceRepayment" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'Scheduled';
ALTER TABLE "SalaryAdvanceRepayment" ADD COLUMN IF NOT EXISTS "generateSalaryID" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SalaryAdvanceRepayment_generateSalaryID_fkey'
  ) THEN
    ALTER TABLE "SalaryAdvanceRepayment"
      ADD CONSTRAINT "SalaryAdvanceRepayment_generateSalaryID_fkey"
      FOREIGN KEY ("generateSalaryID") REFERENCES "GenerateSalary"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
