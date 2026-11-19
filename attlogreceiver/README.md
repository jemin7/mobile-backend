# ATTLOG Receiver

For a plain-language tour of every file, startup, `.env`, and how OpenHRM downloads punches, read [docs/CLIENT-GUIDE.md](docs/CLIENT-GUIDE.md).

Central attendance-punch receiver for OpenHRM. Devices send punches here even when OpenHRM is stopped. The receiver stores every unique punch, promotes only device-verified and payload-valid punches, and lets OpenHRM pull them later.

Domain: `receiver.entimehr.com`  
Database: `ATTLOG_DB`  
Timezone: `Asia/Kolkata`

This service does not identify employees, calculate attendance, or run payroll. OpenHRM keeps those workflows in its own database. OpenAccess attendance now lives in OpenHRM, so this receiver has one inbox.

`ATTLOG_DB.process_attlog` is not OpenHRM's `process_att_logs` table.

## Architecture

```text
ESSL / ZKTeco / Dahua / Mobile product backend
        |
        v
ATTLOG Receiver
        |
        v
att_devices  ->  raw_attlog  ->  punch worker  ->  process_attlog
                                      |                    |
                                      |                    +--> OpenHRM pull API
                                      +--> unverified and invalid rows stay in raw_attlog
```

1. A vendor module receives the device protocol.
2. `RawLogService` commits one `raw_attlog` row per punch line.
3. The device is acknowledged only after that commit.
4. The worker claims `PENDING` rows with `FOR UPDATE SKIP LOCKED`, rechecks the device and payload, and inserts `process_attlog` in the same transaction.
5. OpenHRM pulls `export = 0` rows with `X-Receiver-Key` and marks them exported after saving them locally.

## Database

PostgreSQL database `ATTLOG_DB`. Prisma maps these tables and does not rename them:

| Table | Role |
| --- | --- |
| `att_devices` | Registry of physical devices and mobile installations. `device_sn` is unique. |
| `raw_attlog` | Every unique received punch, including unknown, inactive, mismatched, and malformed punches. |
| `process_attlog` | Receiver-verified punches only. `raw_attlog_id` is unique and references `raw_attlog.id`. |

`process_attlog.punch_time` is `TIMESTAMP WITHOUT TIME ZONE`. The stored digits are Asia/Kolkata wall-clock time, not a UTC instant. `created_at`, `updated_at`, `processed_at`, and `exported_at` are `timestamptz`.

Operational columns on `raw_attlog`: `retry_count`, `last_error`. Administrative actions are stored in `admin_audit_log`. That table is not a punch store.

Processing status: `PENDING`, `PROCESSED`, `QUARANTINED`, `INVALID`, `FAILED`.  
Log type: `verified`, `unverified`.  
Vendors: `ESSL`, `ZKTECO`, `DAHUA`, `MOBILE`.

## Folder guide

| Path | Responsibility |
| --- | --- |
| `prisma/schema.prisma` | Table contract and indexes |
| `prisma/migrations` | SQL migrations |
| `prisma/seed.ts` | No-op seed. Devices are registered through the API |
| `src/main.ts` | HTTP process |
| `src/worker.ts` | Dedicated worker process entry |
| `src/database` | Prisma client |
| `src/devices` | Device registry and product device sync |
| `src/device-routing` | Generic `/iclock` lookup by serial, then the existing eSSL or ZKTeco service |
| `src/raw-log` | The only writer of `raw_attlog`, plus admin raw-log listing |
| `src/punch-processing` | Promotion into `process_attlog`, product pull, reprocess |
| `src/vendors/essl` | eSSL ADMS receiver and parser |
| `src/vendors/zkteco` | ZKTeco ADMS receiver and parser |
| `src/vendors/dahua` | Dahua event receiver and parser |
| `src/mobile` | Punches submitted by a product backend |
| `src/authentication` | Product key, admin bearer token, product scope, optional device IP allowlist |
| `src/administration` | Receiver reports |
| `src/health` | Database health |
| `src/common/time` | Asia/Kolkata normalization |
| `test/unit` | Parser and time tests |
| `test/integration` | Database-backed API tests |

## ESSL

Routes, `GET` and `POST`:

- `/essl/cdata.aspx`
- `/essl/getrequest`
- `/essl/getrequest.aspx`

The serial must already be registered as eSSL. A serial registered as another brand is quarantined as `vendor_mismatch`.

Space-separated and tab-separated lines are supported. Five fields omit verify mode. Six fields include it.

| Verify mode | Auth type |
| --- | --- |
| 0, 3 | PIN |
| 1 | FINGER |
| 2, 4 | CARD |
| 15 | FACE |

Unknown or missing verify mode keeps the original line and stores `auth_type` as null. The device clock is stored as-is. It is not converted from UTC.

```http
POST /essl/cdata.aspx?SN=ESSL001&table=ATTLOG
Content-Type: text/plain

101 2026-10-30 09:05:00 0 1 0
102 2026-10-30 09:10:00 0 0
```

Response after the raw rows commit, including a duplicate retry:

```text
OK
```

`GET` with `options=all` returns ADMS options text (`TimeZone=330`). Other tables, such as `OPERLOG`, are stored once as `non_attendance_event` and acknowledged so the device does not retry forever. A database failure returns plain text `ERROR` and no `OK`.

## Generic device URL

These routes do not assume a brand:

- `POST` and `GET` `/iclock/cdata.aspx`
- `/iclock/getrequest`
- `/iclock/getrequest.aspx`

The receiver reads `SN`, looks up `att_devices`, and calls the existing eSSL or ZKTeco service for that one device. Dahua is not accepted on this address. Brand URLs stay on their own controllers.

| Lookup | Result |
| --- | --- |
| One eSSL or ZKTeco device | That brand's parser. |
| No device | `raw_attlog` with `vendor=UNKNOWN`, `QUARANTINED`. |
| Inactive device | Stored as `device_inactive` and not promoted. |
| No `SN` | Used only when `metadata.dedicated_ip` equals the caller and exactly one device has that IP. Otherwise `missing_serial`. A shared public IP is not used. |
| Line the chosen parser cannot read | Stays in `raw_attlog` and is not promoted. |

A punch that arrives before the device is synced stays quarantined. Registering the device later does not promote that old row by itself.

`GET` handshake and `getrequest` still return the normal ADMS text, including `TimeZone=330` when `options` is requested, so the machine does not retry forever.

## ZKTeco

Routes, `GET` and `POST`:

- `/zkteco/cdata.aspx`
- `/zkteco/getrequest`
- `/zkteco/getrequest.aspx`

The parser implements the public ADMS attendance line independently of the eSSL parser:

```text
PIN <TAB> DateTime <TAB> Status <TAB> Verify <TAB> WorkCode
```

Space-separated lines use the same field order, with date and time as separate tokens. Confirm status/verify order and the acknowledgement text on the target model and firmware before production cutover. Lines that do not match are stored as invalid raw punches and still receive `OK` after commit.

## Dahua

Routes:

- `/dahua/event`
- `/html/dahua/dahua-listener.php`

HTTP Basic credentials come from `DAHUA_BASIC_USER` and `DAHUA_BASIC_PASSWORD`. Only `Code=AccessControl` and `Action=Pulse` can become a punch. Door, alarm, and motion events are stored as `non_attendance_event` and are not promoted.

```http
POST /dahua/event
Authorization: Basic ...
Content-Type: application/json

{
  "Code": "AccessControl",
  "Action": "Pulse",
  "Data": {
    "UserID": "101",
    "RealUTC": "2026-10-30T03:35:00Z",
    "SN": "DH001"
  }
}
```

`RealUTC` / `UTC` is converted to Asia/Kolkata. The example above is stored as `2026-10-30 09:05:00`. Serial is read from the payload or query. If it is missing and exactly one active Dahua device is registered, that device is used. Auth type stays null; the original JSON remains in `raw_body`. Invalid JSON is stored as `INVALID`.

## Mobile

`POST /mobile/punch` accepts OpenHRM's backend, authenticated with `X-Receiver-Key`. Do not put the receiver key in a mobile application. Geofence, photo, and employee checks stay in OpenHRM.

```json
{
  "installation_id": "MOB-001",
  "employee_code": "EMP101",
  "punched_at": "2026-10-30T09:05:00+05:30",
  "latitude": 19.0,
  "longitude": 72.0,
  "accuracy": 10,
  "address": "Office Location",
  "photo_url": "https://example.com/photo.jpg",
  "check_type": "CHECK_IN"
}
```

Mapping: `vendor=MOBILE`, `device_sn=installation_id`, `user_id=employee_code`, `auth_type=GPS`, `status=check_type`. An offset is converted to Asia/Kolkata. A timestamp without a zone is already India local time. An unknown or inactive installation is quarantined. The full JSON is `raw_body`.

## Device registration

Two ways to register a machine. A serial can belong to only one device. Devices are deactivated, not deleted.

### Automatic sync from OpenHRM

`POST /integration/att-devices/sync` uses `X-Receiver-Key` (`RECEIVER_KEY`).

```http
POST /integration/att-devices/sync
X-Receiver-Key: RECEIVER_KEY
Content-Type: application/json

{
  "source_device_id": "42",
  "vendor": "ESSL",
  "device_sn": "ESSL001",
  "device_name": "Main Gate",
  "device_model": "K90",
  "status": 1
}
```

The same `source_device_id` updates the same row, including a later serial or vendor change. If the row was created earlier without a source id, the same vendor and serial is updated and the source id is stored. `deleted: true` sets `status` to 0 and does not remove the row. A repeated call does not create a second row. A second source id for a serial that already exists returns 409. The paste-ready prompt for the live OpenHRM agent is [docs/PRODUCT-DEVICE-SYNC-PROMPT.md](docs/PRODUCT-DEVICE-SYNC-PROMPT.md).

### Admin API

Admin bearer token is required.

```http
POST /att-devices
Authorization: Bearer ADMIN_AUTH_SECRET
Content-Type: application/json

{
  "vendor": "ESSL",
  "device_sn": "ESSL001",
  "device_name": "Main Gate",
  "status": 1
}
```

`GET /att-devices` filters on `vendor`, `device_sn`, and `status`.  
`GET /att-devices/:id`  
`PATCH /att-devices/:id`  
`PATCH /att-devices/:id/status` with `{ "status": 0 }`

A device is verified only when the serial exists, the vendor matches the receiving route, and `status` is 1. A duplicate serial is rejected. `source_device_id` is unique and may be empty on older rows.

## Raw punch processing

Each punch line is one row. A repeated delivery updates `duplicate_count` and returns the normal acknowledgement. The hash covers vendor, serial, user, normalized time, status, work code, auth type, and a vendor event id when one exists. Invalid lines also include the raw text so different bad lines are kept.

Eligible rows move to `process_attlog` only when the device is verified and the payload has a user id and a valid timestamp. The worker can run inside the API (`WORKER_EMBEDDED=true`) or as `npm run start:worker`. Set `WORKER_EMBEDDED=false` on the API when a separate worker is deployed. Both can run safely because of `SKIP LOCKED`.

Failed rows are returned to `PENDING` until `PROCESSING_MAX_RETRIES`. A row is marked `PROCESSED` only after the `process_attlog` insert commits.

## Unverified punches

Unknown, inactive, vendor-mismatch, and missing-serial punches remain in `raw_attlog` with `processing_status=QUARANTINED`. They are not returned by `GET /process-attlog`. A punch received before that serial is synced stays quarantined after the sync.

After the device is registered, an administrator reprocesses them:

```http
POST /admin/raw-attlog/reprocess
Authorization: Bearer ADMIN_AUTH_SECRET
Content-Type: application/json

{ "device_sn": "ESSL009" }
```

The call requires `ids`, `device_sn`, or `vendor` plus a date range. Original `raw_body` is not overwritten. The action is written to `admin_audit_log`. `PROCESSED` rows are left unchanged.

## Receiver authentication

Send `X-Receiver-Key` with the value of `RECEIVER_KEY`. OpenHRM uses this one secret for device sync, mobile punches, and the pull API. A wrong key is rejected.

## Pull API

```http
GET /process-attlog?export=0&after_id=0&limit=500
X-Receiver-Key: RECEIVER_KEY
```

Every `process_attlog` row with `export=0` is returned, ordered by id.

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "raw_attlog_id": 1,
      "vendor": "ESSL",
      "device_sn": "ESSL001",
      "user_id": "101",
      "punch_time": "2026-10-30T09:05:00",
      "status": "0",
      "work_code": "0",
      "auth_type": "FINGER",
      "export": 0
    }
  ],
  "pagination": {
    "after_id": 0,
    "next_after_id": 1,
    "limit": 500,
    "has_more": false
  }
}
```

`punch_time` has no offset. It is India local wall time.

```http
POST /process-attlog/mark-exported
X-Receiver-Key: RECEIVER_KEY
Content-Type: application/json

{ "ids": [1, 2, 3] }
```

This sets `export=1` and `exported_at`. Marking them again is a success with `updated: 0`. Rows are not deleted. Delivery is at-least-once: if OpenHRM saves punches and crashes before this call, the same ids are returned on the next pull.

## OpenHRM integration

Do this inside OpenHRM, not in this repository.

1. Sync each device with `POST /integration/att-devices/sync` using `RECEIVER_KEY` and that device's `source_device_id`. See [docs/PRODUCT-DEVICE-SYNC-PROMPT.md](docs/PRODUCT-DEVICE-SYNC-PROMPT.md).
2. Call `GET /process-attlog` with `RECEIVER_KEY`.
3. Skip any central `id` already imported.
4. Insert the punch into the existing `essl_raw_attlog` path, or adapt the existing processor to read these fields.
5. Keep `EmpDeviceMapping`, `essl-raw-processor`, `process_att_logs`, canteen processing, mobile rules, `AttendanceLocation`, payroll, and reports.
6. Call `mark-exported` only after the local transaction commits.
7. Use the central `process_attlog.id` as the external source id so a retry does not create a second local attendance row.

Do not rename either `process_attlog` or `process_att_logs`.

OpenAccess is not a second receiver client. Its attendance data moves into OpenHRM, and OpenHRM pulls every punch from this inbox.

## Add a manufacturer

Add `src/vendors/<name>/` with its own controller, service, and parser. Parse into the shared ingest shape and call `RawLogService.ingest`. Do not insert `process_attlog` from the controller and do not add a vendor punch table. Register the vendor name in `src/common/enums` only if it is not one of the current four.

## Environment

Copy `.env.example` to `.env`. Never commit `.env`.

```env
NODE_ENV=production
PORT=8000
DATABASE_URL=postgresql://postgres@127.0.0.1:5432/ATTLOG_DB
RECEIVER_KEY=
ADMIN_AUTH_SECRET=
TIMEZONE=Asia/Kolkata
DAHUA_BASIC_USER=
DAHUA_BASIC_PASSWORD=
DEVICE_IP_ALLOWLIST=
BODY_LIMIT=1mb
WORKER_EMBEDDED=true
WORKER_INTERVAL_MS=2000
WORKER_BATCH_SIZE=50
PROCESSING_MAX_RETRIES=5
```

`DEVICE_IP_ALLOWLIST` is optional. Empty means device routes accept any source IP. Use HTTPS at the proxy in production.

## Local development

Requires Node.js 20 and PostgreSQL.

```text
createdb ATTLOG_DB
copy .env.example .env
npm install
npx prisma migrate dev
npm run start:dev
```

Health check: `GET http://127.0.0.1:8000/health`

```text
npm test
npm run test:e2e
```

Integration tests use database `ATTLOG_DB_TEST` and do not touch `ATTLOG_DB`.

## Production deployment

The receiver runs on its own host. If OpenHRM is down, devices can still punch.

```text
https://receiver.entimehr.com
        |
      NGINX
        |
   NestJS :8000
        |
   PostgreSQL / ATTLOG_DB
```

1. Install Node.js 20 or newer and PostgreSQL.
2. Create database `ATTLOG_DB`.
3. Set the environment variables above.
4. `npm ci`
5. `npx prisma migrate deploy`
6. `npm run build`
7. Start with PM2:

```text
pm2 start dist/main.js --name attlog-receiver
pm2 start dist/worker.js --name attlog-worker
```

When using the dedicated worker, set `WORKER_EMBEDDED=false` for the API process.

Nginx should proxy `https://receiver.entimehr.com` to `http://127.0.0.1:8000`, allow request bodies up to the configured limit, and forward `X-Forwarded-For`. Terminate TLS on Nginx. Open only 443 publicly and keep PostgreSQL on localhost or a private network. Rotate application logs and take PostgreSQL backups. Alert on `GET /health`.

## Monitoring

`GET /health` runs `SELECT 1`.

Admin reports, all bearer-authenticated and paginated:

- `GET /admin/raw-attlog`
- `GET /admin/reports/raw-punches`
- `GET /admin/reports/processed-punches`
- `GET /admin/reports/unverified-punches`
- `GET /admin/reports/invalid-punches`
- `GET /admin/reports/summary`

Filters include vendor, device, user, date, log type, validity, processing status, and verification reason. Summary counts are SQL aggregates.

Date filters on raw reports use `created_at` in Asia/Kolkata. Processed-punch dates filter the stored wall-clock `punch_time`.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Device keeps retrying | The response was `ERROR` or the connection failed before commit. Check PostgreSQL and `GET /health`. Do not return `OK` from a proxy if the app is down. |
| Punch stays `QUARANTINED` | Serial, vendor, or `status`. Register or reactivate the device, then `POST /admin/raw-attlog/reprocess`. |
| Punch stays `INVALID` | User id or timestamp. The raw line is in `raw_body`. |
| Punch stays `FAILED` | `last_error` and `retry_count`. The worker retries until `PROCESSING_MAX_RETRIES`. |
| OpenHRM sees no punches | Wrong `RECEIVER_KEY`, or the rows are already `export=1`. |
| Dahua time is four hours off | The payload was local time labeled as UTC, or the reverse. Confirm `RealUTC` on that firmware. |
| ZKTeco field order looks swapped | Confirm the model firmware. The parser documents the public ADMS order and can be adjusted in `zkteco.parser.ts` only. |
