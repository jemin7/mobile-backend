DO $$ BEGIN
  CREATE TYPE "DashboardActorType" AS ENUM ('EMPLOYEE', 'USER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DashboardType" AS ENUM ('HOME');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "dashboard_preference" (
  "id" SERIAL NOT NULL,
  "companyId" INTEGER NOT NULL,
  "actorType" "DashboardActorType" NOT NULL,
  "actorId" INTEGER NOT NULL,
  "dashboardType" "DashboardType" NOT NULL DEFAULT 'HOME',
  "layout" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dashboard_preference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "dashboard_preference_companyId_actorType_actorId_dashboardType_key"
  ON "dashboard_preference"("companyId", "actorType", "actorId", "dashboardType");

CREATE INDEX IF NOT EXISTS "dashboard_preference_companyId_dashboardType_idx"
  ON "dashboard_preference"("companyId", "dashboardType");
