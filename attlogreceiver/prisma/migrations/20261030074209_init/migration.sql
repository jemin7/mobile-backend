-- CreateTable
CREATE TABLE "att_devices" (
    "id" BIGSERIAL NOT NULL,
    "software_key" VARCHAR(50) NOT NULL,
    "vendor" VARCHAR(30) NOT NULL,
    "device_sn" VARCHAR(150) NOT NULL,
    "device_name" VARCHAR(150) NOT NULL,
    "device_model" VARCHAR(100),
    "firmware_version" VARCHAR(100),
    "status" SMALLINT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "att_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_attlog" (
    "id" BIGSERIAL NOT NULL,
    "software_key" VARCHAR(50),
    "vendor" VARCHAR(30) NOT NULL,
    "device_sn" VARCHAR(150) NOT NULL,
    "request_path" TEXT,
    "query_params" JSONB,
    "raw_body" TEXT,
    "ip_address" VARCHAR(50),
    "is_valid" BOOLEAN NOT NULL,
    "log_type" VARCHAR(30) NOT NULL,
    "processing_status" VARCHAR(30) NOT NULL,
    "verification_reason" TEXT,
    "user_id" VARCHAR(100),
    "source_punch_time" TEXT,
    "punch_time" TEXT,
    "status" VARCHAR(30),
    "work_code" VARCHAR(50),
    "auth_type" VARCHAR(30),
    "dedupe_hash" VARCHAR(64) NOT NULL,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "raw_attlog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_attlog" (
    "id" BIGSERIAL NOT NULL,
    "raw_attlog_id" BIGINT NOT NULL,
    "software_key" VARCHAR(50) NOT NULL,
    "vendor" VARCHAR(30) NOT NULL,
    "device_sn" VARCHAR(150) NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "punch_time" TIMESTAMP(0) NOT NULL,
    "source_punch_time" TEXT,
    "status" VARCHAR(30),
    "work_code" VARCHAR(50),
    "auth_type" VARCHAR(30),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "export" SMALLINT NOT NULL DEFAULT 0,
    "exported_at" TIMESTAMPTZ(6),

    CONSTRAINT "process_attlog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_log" (
    "id" BIGSERIAL NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "actor" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(50) NOT NULL,
    "target_id" VARCHAR(100),
    "details" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "att_devices_vendor_idx" ON "att_devices"("vendor");

-- CreateIndex
CREATE INDEX "att_devices_status_idx" ON "att_devices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "att_devices_software_key_device_sn_key" ON "att_devices"("software_key", "device_sn");

-- CreateIndex
CREATE UNIQUE INDEX "raw_attlog_dedupe_hash_key" ON "raw_attlog"("dedupe_hash");

-- CreateIndex
CREATE INDEX "raw_attlog_software_key_idx" ON "raw_attlog"("software_key");

-- CreateIndex
CREATE INDEX "raw_attlog_vendor_idx" ON "raw_attlog"("vendor");

-- CreateIndex
CREATE INDEX "raw_attlog_device_sn_idx" ON "raw_attlog"("device_sn");

-- CreateIndex
CREATE INDEX "raw_attlog_user_id_idx" ON "raw_attlog"("user_id");

-- CreateIndex
CREATE INDEX "raw_attlog_log_type_idx" ON "raw_attlog"("log_type");

-- CreateIndex
CREATE INDEX "raw_attlog_processing_status_idx" ON "raw_attlog"("processing_status");

-- CreateIndex
CREATE INDEX "raw_attlog_is_valid_idx" ON "raw_attlog"("is_valid");

-- CreateIndex
CREATE INDEX "raw_attlog_created_at_idx" ON "raw_attlog"("created_at");

-- CreateIndex
CREATE INDEX "raw_attlog_worker_idx" ON "raw_attlog"("processing_status", "log_type", "is_valid", "id");

-- CreateIndex
CREATE UNIQUE INDEX "process_attlog_raw_attlog_id_key" ON "process_attlog"("raw_attlog_id");

-- CreateIndex
CREATE INDEX "process_attlog_software_key_idx" ON "process_attlog"("software_key");

-- CreateIndex
CREATE INDEX "process_attlog_raw_attlog_id_idx" ON "process_attlog"("raw_attlog_id");

-- CreateIndex
CREATE INDEX "process_attlog_device_sn_idx" ON "process_attlog"("device_sn");

-- CreateIndex
CREATE INDEX "process_attlog_user_id_idx" ON "process_attlog"("user_id");

-- CreateIndex
CREATE INDEX "process_attlog_punch_time_idx" ON "process_attlog"("punch_time");

-- CreateIndex
CREATE INDEX "process_attlog_export_idx" ON "process_attlog"("export");

-- CreateIndex
CREATE INDEX "process_attlog_software_export_id_idx" ON "process_attlog"("software_key", "export", "id");

-- CreateIndex
CREATE INDEX "admin_audit_log_created_at_idx" ON "admin_audit_log"("created_at");

-- CreateIndex
CREATE INDEX "admin_audit_log_action_idx" ON "admin_audit_log"("action");

-- AddForeignKey
ALTER TABLE "process_attlog" ADD CONSTRAINT "process_attlog_raw_attlog_id_fkey" FOREIGN KEY ("raw_attlog_id") REFERENCES "raw_attlog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
