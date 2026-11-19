-- Drop product indexes before removing software_key.
DROP INDEX IF EXISTS "att_devices_software_key_device_sn_key";
DROP INDEX IF EXISTS "att_devices_software_key_source_device_id_key";
DROP INDEX IF EXISTS "raw_attlog_software_key_idx";
DROP INDEX IF EXISTS "process_attlog_software_key_idx";
DROP INDEX IF EXISTS "process_attlog_software_export_id_idx";

ALTER TABLE "att_devices" DROP COLUMN "software_key";
ALTER TABLE "raw_attlog" DROP COLUMN "software_key";
ALTER TABLE "process_attlog" DROP COLUMN "software_key";

CREATE UNIQUE INDEX "att_devices_device_sn_key" ON "att_devices"("device_sn");
CREATE UNIQUE INDEX "att_devices_source_device_id_key" ON "att_devices"("source_device_id");
CREATE INDEX "process_attlog_export_id_idx" ON "process_attlog"("export", "id");
