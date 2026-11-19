-- AlterTable
ALTER TABLE "att_devices" ADD COLUMN "source_device_id" VARCHAR(100);

-- CreateIndex
CREATE UNIQUE INDEX "att_devices_software_key_source_device_id_key" ON "att_devices"("software_key", "source_device_id");
