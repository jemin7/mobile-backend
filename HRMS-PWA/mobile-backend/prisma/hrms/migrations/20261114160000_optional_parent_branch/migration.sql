-- Parent branch is optional on records that previously required a branch.
ALTER TABLE "BankDetails" ALTER COLUMN "branchesID" DROP NOT NULL;
ALTER TABLE "EmployeeTermination" ALTER COLUMN "branchesID" DROP NOT NULL;
ALTER TABLE "Overtime" ALTER COLUMN "branchesID" DROP NOT NULL;
ALTER TABLE "Roster" ALTER COLUMN "branchesID" DROP NOT NULL;
ALTER TABLE "EmpAttendanceLogs" ALTER COLUMN "branchesID" DROP NOT NULL;
ALTER TABLE "PTCompliance" ALTER COLUMN "branchID" DROP NOT NULL;
