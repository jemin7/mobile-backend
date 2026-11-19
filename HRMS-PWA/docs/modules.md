# EN-Time HR module notation

This handbook is the single note for every company and employee section. It explains where to click, what create saves, how the record is used later, and which API stores it.

The browser calls `/backend/...`. That path is proxied to the API with no extra prefix, so `POST /backend/branches` is `POST /branches`.

Company owners start at the sidebar **My Company** tile menu (`/my-company`). Each tile opens `/my-company/{tile}?tab={tab}`. Employees use the PWA home, profile, leave, reimbursement, and payout screens. The same screens exist as standalone URLs such as `/branches` and `/manage-employees`.

Every working section uses four headings:

- **Open.** Sidebar, tile, tab, and the button that opens the form or modal.
- **Create.** The fields that matter and what save writes.
- **How it works.** Which later screen reads the record.
- **APIs.** List, create, update, and any special action. A database table is named only when it explains storage, as with punches.

A tab marked coming soon has no create flow yet.

## Contents

- [PWA app](#pwa-app)
- [Who punches where](#who-punches-where)
- [My Company tile](#my-company-tile)
- [Company profile](#company-profile)
- [Branches](#branches)
- [Company hierarchy](#company-hierarchy)
- [Federal domain](#federal-domain)
- [Employees](#employees)
- [Departments](#departments)
- [Designations](#designations)
- [Promotions and transfers](#promotions-and-transfers)
- [Rights, credentials, and documents](#rights-credentials-and-documents)
- [Offboarding](#offboarding)
- [Attendance devices](#attendance-devices)
- [Map an employee to a device](#map-an-employee-to-a-device)
- [How punches are stored](#how-punches-are-stored)
- [Work shifts](#work-shifts)
- [Attendance policy](#attendance-policy)
- [Half day](#half-day)
- [Roster](#roster)
- [Regularisation](#regularisation)
- [Attendance logs](#attendance-logs)
- [Mobile and field attendance](#mobile-and-field-attendance)
- [Weekly off and holiday override](#weekly-off-and-holiday-override)
- [Overtime](#overtime)
- [Leave applications](#leave-applications)
- [Leave policy](#leave-policy)
- [Holidays](#holidays)
- [Privileged leave](#privileged-leave)
- [Policy Management tile](#policy-management-tile)
- [Reimbursements](#reimbursements)
- [Salary advances](#salary-advances)
- [Payroll setup](#payroll-setup)
- [Salary generation](#salary-generation)
- [Payslips](#payslips)
- [Reports](#reports)
- [Statutory PF, ESI, and PT](#statutory-pf-esi-and-pt)
- [Contractors](#contractors)
- [Tasks](#tasks)
- [CRM customers and sites](#crm-customers-and-sites)
- [Employee home and profile](#employee-home-and-profile)
- [My Team and approvals](#my-team-and-approvals)
- [Internal messaging](#internal-messaging)
- [Approval workflows](#approval-workflows)
- [Coming soon](#coming-soon)
- [Database schema](#database-schema)
- [What each table stores](#what-each-table-stores)

## PWA app

### Open

The app is the live site `https://app.entimehr.com`. There is no separate store listing. The browser manifest (`/manifest.json`) names it HRMS, uses standalone display, and starts at `/`.

### Create

Install it from the browser after opening the site:

- Android Chrome: use the browser **Install app** or **Add to Home screen** prompt.
- iPhone Safari: **Share**, then **Add to Home Screen**.

Opening the home-screen icon loads the same sign-in page full screen. Sign in with the employee code and password created under Employee Management.

### How it works

After login, the phone layout is Home, Attendance, Leave, Reimbursement, and Payout. Tasks and Team appear when those modules are on for that person. Home is `/empdashboard`. Attendance opens `/empProfile?tab=attendance`. Leave, reimbursement, and payout are the same records as the company screens.

The installed app does not keep punches on the phone. Offline Workbox caching is turned off. The service worker that registers is `/push-sw.js`, and it is only for notifications. A punch is sent to the server immediately, the same way as the browser.

### APIs

- The page manifest is `GET /manifest.json`.
- Notifications: `GET /backend/push-notifications/vapid-public-key`, `POST /backend/push-notifications/subscribe`.
- Sign-in from the installed app is the same login API as the browser: `POST /backend/auth/login`, then `POST /backend/auth/login/verify-otp` when a code is required.

## Who punches where

### Open

Employee form, tab **Attendance & Selfcare Setup**. The checkbox is **Enable mobile app attendance**.

### Create

Tick the box only for people who should punch from the PWA. Leave it unticked for people who punch on an attendance device. The device mapping on the same tab is required for device users: pick the device, enter the device employee code, and choose FACE, FINGER, PIN, or CARD.

### How it works

- Mobile attendance on: that person uses **Check-in** and **Mark Absent** on the PWA home. Device punches for that person are ignored. The punch is stored by `POST /backend/emp-location-attendance/punch` in `attendance_locations` and copied into `process_att_logs` with device serial `LOCATION_APP`.
- Mobile attendance off: punches come from the attendance device. The code on the device must match the device employee code, or the punch stays raw and never reaches the employee report. The storage path is [How punches are stored](#how-punches-are-stored).

### APIs

- The flag is saved with the employee: `POST /backend/manage-emp` or `PATCH /backend/manage-emp/:id`.
- App punch: `POST /backend/emp-location-attendance/punch` and `POST /backend/emp-location-attendance/mark-absent`.
- Device mapping rows are `EmpDeviceMapping` on the same employee save.


## My Company tile

### Open

1. Sidebar **My Company**.
2. Tile **My Company** (`/my-company/company`).

Tabs: **Dashboard**, **Company Profile**, **Branches**, **Attendance Devices**, **Company Hierarchy**.

### How it works

The dashboard is a summary. It does not create records. Devices are documented in [Attendance devices](#attendance-devices). The other tabs are below.

## Company profile

### Open

Tile **My Company**, tab **Company Profile**.

### Create

This edits the company the signed-in owner already belongs to. The company name on the employee form comes from this profile, and that field stays locked.

### How it works

Employees, branches, devices, and payroll for this company all hang off this profile. An employee cannot be moved to another company from the employee form.

### APIs

- `GET /backend/company` lists companies visible to the user.
- `PATCH /backend/company/:id` and `PATCH /backend/company/:id/profile` update the profile.
- `POST /backend/company/:id/owner` and `PATCH /backend/company/:id/owner/:ownerId` manage the owner login.

## Branches

### Open

1. Sidebar **My Company**.
2. Tile **My Company**.
3. Tab **Branches** (`/my-company/company?tab=branches`).
4. **Add Branch**. The form opens in a modal.

Standalone page: `/branches`.

### Create

Enter the branch name and the address fields the form asks for. The branch belongs to the current company. A company with only one branch has that branch locked on the employee form.

### How it works

Employees, devices, holidays, and reports are scoped to a branch. Saving an employee writes the selected branch into the employee branch history, so attendance and payroll keep the placement even though the form shows a single branch control.

### APIs

- `GET /backend/branches`
- `POST /backend/branches`
- `PATCH /backend/branches/:id`

## Company hierarchy

### Open

Tile **My Company**, tab **Company Hierarchy**. Standalone page: `/company-hierarchy`.

### How it works

This is a view of the reporting tree built from each employee's reporting manager. There is no separate create button. Change the tree by setting **Reporting Manager** on the employee form.

### APIs

- `GET /backend/company-hierarchy` is read-only.

## Federal domain

### Open

The federal-domain screen is linked from company setup as `/my-company/company?tab=federal-domain` and as the standalone page `/federal-domain`. It is not one of the five tabs on the My Company tile.

### Create

**Create a new code** or **Add fetched code** attaches a federal domain code to the company.

### How it works

The code identifies the company for cross-company or integration lookups. It is not required to create a branch or an employee.

### APIs

- `POST /backend/company/:id/federal-domain`

## Employees

### Open

1. Sidebar **My Company**.
2. Tile **Employee Management**.
3. Tab **Employees** (`/my-company/employee-management?tab=employees`).
4. **Add Employee**. The form is a tabbed modal.

Standalone page: `/manage-employees`.

### Create

The form tabs, in order:

1. **Basic Information.** Employee code, first, middle and last name, date of birth, gender, blood group, marital status, personal mobile, personal email, photo.
2. **Employment Details.** Company (locked), branch (locked when the company has one branch), department, designation, date of joining, employment type, reporting manager. Save writes one current history row for branch, department, designation, employment type, and manager.
3. **Address & Emergency Contacts.** Current address, city, state, PIN, country, permanent address, and the emergency contact card.
4. **Statutory & KYC.** PAN, Aadhaar number, EPF and ESI checkboxes. UAN and PF Member ID show only when EPF is ticked. ESIC Insurance Number shows only when ESI is ticked. Unticking a box clears those numbers on save.
5. **Bank & Payroll.** Payment mode, pay grade, salary effective date, and the bank account (account holder, account number, IFSC, bank name).
6. **Attendance & Leave Policies.** Attendance policy, work shift, leave policy, holiday calendar.
7. **Documents.** Document type, file, expiry date.
8. **Policy & Review.** Policy selection, signed policy scan, acknowledgement method, engagement-survey consent. The scan is stored inside the existing `privacyReview` JSON.
9. **Attendance & Selfcare Setup.** Mobile attendance and the device mapping described in [Map an employee to a device](#map-an-employee-to-a-device).
10. **Rights & Permissions.** Which company screens this employee may open.

The employee code is also the login username. **Generate / Edit Credentials** on the employee list sets the password.

### How it works

Attendance, leave, payroll, and team dashboards all start from this employee. Family fields are no longer on the form; values already stored stay in the database. The same is true of office mobile, employment status, contractor, and the old with-effect-from grids: the form no longer edits them, and existing rows remain for reports.

### APIs

- `GET /backend/manage-emp` and `GET /backend/manage-emp/list`
- `POST /backend/manage-emp` creates the employee and the nested history, bank, documents, and device rows.
- `PATCH /backend/manage-emp/:id` updates them.
- `POST /backend/manage-emp/:id/documents` and `PATCH /backend/manage-emp/documents/:documentId` manage files after create.
- `POST /backend/manage-emp/:id/linked-employees` stores the reporting manager.
- `PATCH /backend/manage-emp/:id/credentials` and `PATCH /backend/manage-emp/:id/credentials/status` set the login.
- `POST /backend/files/upload` stores the photo and the signed policy scan. The returned URL is saved on the employee.
- `GET /backend/bank-details`, `POST /backend/bank-details`, `PATCH /backend/bank-details/:id` are the bank-detail endpoints used with the employee record.

## Departments

### Open

Tile **Employee Management**, tab **Departments**. **Add Department**. Standalone page: `/departments`.

### Create

Department name for the current company. The employee form searches this list.

### How it works

The department chosen on the employee is written into department history and is what team lists and reports group by.

### APIs

- `GET /backend/departments`
- `POST /backend/departments`
- `PATCH /backend/departments/:id`

## Designations

### Open

Tile **Employee Management**, tab **Designations**. **Add Designation**. Standalone page: `/designations`.

### Create

Designation name. Designations can be limited to a department. Changing the department on the employee form clears the designation so a designation from another department is not kept.

### How it works

Payroll pay grades and reports display the designation from the employee history.

### APIs

- `GET /backend/designations`
- `POST /backend/designations`
- `PATCH /backend/designations/:id`

## Promotions and transfers

### Open

Tile **Employee Management**, tab **Transitions**. **Add Promotion & Transfers**.

Manager path: sidebar **My Team**, **Promotions & Transfers** (`/empTeam/promotions`).

Standalone page: `/employees-promotions`.

### Create

Pick the employee, the new department, designation, or branch, and the effective date. The company-transfer checkbox is not on this form. A promotion stays inside the current company.

### How it works

On the effective date the new placement becomes the current department, designation, or branch. Attendance and payroll after that date use the new row. Older history rows stay so past reports do not change.

### APIs

- `GET /backend/emp-promotion`, `POST /backend/emp-promotion`, `PATCH /backend/emp-promotion/:id`
- `GET /backend/promotion-request`, `PATCH /backend/promotion-request/:id` for a request that is waiting on approval.
- `GET /backend/emp-current-position`, `POST /backend/emp-current-position`, `PATCH /backend/emp-current-position/:id` hold the current placement used by other screens.

## Rights, credentials, and documents

### Open

Rights and documents are tabs on the employee form, not separate tiles. Credentials are **Generate / Edit Credentials** on the employee list.

### How it works

Rights decide which My Company tiles and tabs this person sees. A company owner already has full company access. Documents uploaded here are the employee's file record (identity, letters, and so on), separate from the signed policy scan on Policy & Review.

### APIs

- `GET /backend/employee-permissions`, `GET /backend/employee-permissions/me`, `GET /backend/employee-permissions/modules`, `PUT /backend/employee-permissions`
- `GET /backend/company-access/me` tells the shell which modules the company subscription includes.
- Document and credential routes are the `manage-emp` routes listed under Employees.

## Offboarding

### Open

1. Sidebar **My Company**.
2. Tile **Offboarding**.
3. Tab **Offboarding**.
4. **Initiate Off Boarding**. The drawer title is **Initiate Exit**.

The same screen is **Policy Management**, tab **Offboarding Policy**, and the standalone page `/termination`.

### Create

Pick the employee, the exit reason, and the last working day. Later actions on the same record are approve, final settlement, and cancel.

### How it works

An exited employee drops out of active attendance, leave, and payroll runs after the last working day. The employee row is not deleted. History, punches, and payslips stay.

### APIs

- `GET /backend/termination`
- `POST /backend/termination`
- `PUT /backend/termination/:id/approve`
- `PUT /backend/termination/:id/final-settle`
- `PUT /backend/termination/:id/cancel`


## Attendance devices

### Open

1. Sidebar **My Company**.
2. Tile **My Company**.
3. Tab **Attendance Devices** (`/my-company/company?tab=devices`).
4. **Add Device**.

The same form is the standalone page `/devices`.

### Create

Save the device name, company and branch, make and model, serial number (`deviceSN`), device type (attendance devices default to `AT`), and the attendance auth type (face, finger, PIN, or card). Optional latitude and longitude are used when the device location is resolved.

### How it works

The serial number is how an incoming punch is matched to this device. Devices are attendance devices. A verified punch is written to `process_att_logs`. If the server is running in receiver mode, creating or updating a device also syncs that device to the attendance receiver. The receiver process itself is left running; this handbook does not change it.

### APIs

- `GET /backend/devices` lists devices.
- `POST /backend/devices` creates one. Stored in `Devices`.
- `PATCH /backend/devices/:id` updates it.
- `DELETE /backend/devices/:id` removes it.
- `GET /backend/devices/resolve-address` resolves a map address.
- `GET /backend/receiver-link/status` and `POST /backend/receiver-link/backfill-devices` are the receiver link helpers.

## Map an employee to a device

### Open

1. Sidebar **My Company**.
2. Tile **Employee Management**.
3. Tab **Employees**.
4. **Add Employee** (or Edit on an existing row).
5. Form tab **Attendance & Selfcare Setup**.

The same form is `/manage-employees`.

### Create

On the device mapping, pick the attendance device, enter the **device employee code**, and choose the auth type (FACE, FINGER, PIN, or CARD). The device employee code must be the user id programmed on the physical device. The same person must also exist as an employee in the software, with a branch, department, designation, joining date, employment type, and reporting manager on **Employment Details**.

Mobile attendance is a separate checkbox on the same tab. When it is on, that employee punches from the mobile app and device punches for that person are ignored.

### How it works

A punch line carries a device serial and a user id. Processing looks up `EmpDeviceMapping` for that pair and writes the punch against the HR employee in `process_att_logs`. If the code on the device does not match `deviceEmpCode`, the punch stays raw and does not appear on the employee report.

### APIs

- `POST /backend/manage-emp` creates the employee, including `devices[]` of `{ deviceID, deviceEmpCode, authType }`.
- `PATCH /backend/manage-emp/:id` updates the employee and the mapping.
- Mapping rows are stored in `EmpDeviceMapping`.

## How punches are stored

There are three ways a punch becomes a row that reports can read. All three end in `process_att_logs`, which is the table attendance logs, regularisation, salary, and attendance reports use.

### Device posts directly to the HR API

1. The device calls `POST /backend/cdata.aspx?SN={serial}&table=attlog` with ATTLOG lines.
2. Those lines are stored raw in `AttendanceLogs` with `processed` still `0`.
3. `GET /backend/sync-emp-attendance` matches each raw row to an employee and writes `EmpAttendanceLogs` and `process_att_logs`, then marks the raw row processed.
4. `POST /backend/cdata-batch` and `GET /backend/cdata-batch` are the batch form of the same ingest.

### Receiver and the Next receive route

1. The attendance receiver collects device punches. The HR server pulls them when attendance source is set to the receiver.
2. The Next route `POST /api/receive?SN={serial}&table=ATTLOG` inserts the same style of raw line into `essl_raw_attlog`.
3. `GET /backend/process-essl-raw` maps `essl_raw_attlog` through the device mapping and writes `process_att_logs`.

Both raw tables can exist at once. Reports do not read them. They read `process_att_logs`.

### Mobile check-in

1. The employee opens **Home** (`/empdashboard`) and uses **Check-in** or **Mark Absent**.
2. `POST /backend/emp-location-attendance/punch` stores the punch in `attendance_locations` and mirrors a row into `process_att_logs` with device serial `LOCATION_APP`.
3. `POST /backend/emp-location-attendance/mark-absent` records an absent declaration.
4. `GET /backend/emp-location-attendance/today` and `GET /backend/emp-location-attendance/my` show that employee's status and history.

### Import attendance

**Attendance Management**, tab **Import Attendance**, uploads a CSV or Excel file.

- `POST /backend/import-attendance/upload` writes `essl_raw_attlog` and `process_att_logs`.
- `GET /backend/import-attendance/imported` lists what was imported.
- `DELETE /backend/import-attendance/imported` clears imported rows.
- `GET /backend/import-attendance/template` downloads the template.

### Processed log API

- `GET /backend/process-att-logs` lists processed punches. Filters cover employee, device, and date.
- `GET /backend/process-att-logs/by-devices`, `/by-device/:deviceId`, `/by-username/:username`, `/summary`, and `/stats` are the other reads.
- `POST /backend/process-att-logs` and `PATCH /backend/process-att-logs/:id` exist for manual correction.
- `GET /backend/emp-attendance-logs` reads the older `EmpAttendanceLogs` table. Reports use `process_att_logs` instead.
- `GET /backend/dashboard-overview/today-overview` is what the attendance log screen uses for today's board.

## Work shifts

### Open

1. Sidebar **My Company**.
2. Tile **Attendance Management**.
3. Tab **Work Shifts** (`/my-company/attendance?tab=shifts`).
4. **Add Work Shift**.

Standalone page: `/work-shifts`. The same screen is also **Policy Management**, tab **Work Shift Policy**.

### Create

A shift has a name, start and end time, break, and the late and half-day rules that attendance policy and roster assignment use.

### How it works

An employee is given a shift on the employee form (**Attendance & Leave Policies**, Work Shift) or through the roster. Punch pairs in `process_att_logs` are compared with that shift to decide present, late, and half day.

### APIs

- `GET /backend/work-shift`
- `POST /backend/work-shift`
- `PATCH /backend/work-shift/:id`

## Attendance policy

### Open

1. Tile **Attendance Management**.
2. Tab **Attendance Policy**.
3. **Add Attendance Policy**.

Standalone page: `/attendance-policy`. Also under **Policy Management**, tab **Attendance Policy**.

### Create

The policy holds the rules for late marks, absence, overtime, and how a day is classified. Assign it on the employee form under **Attendance & Leave Policies**.

### How it works

Reports and payroll read the policy that was effective for the employee on that day, together with the shift and the punches.

### APIs

- `GET /backend/attendance-policy`
- `POST /backend/attendance-policy`
- `PATCH /backend/attendance-policy/:id`


## Half day

### Open

The rule is set on **Attendance Management**, tab **Attendance Policy**, field **Minimum Work Hours for Half Day (In Minutes)**. The self dashboard shows the month's **Half Day** count. Salary generation uses the same rule when it counts loss of pay.

### Create

Enter the minimum minutes that still count as a half day. Also set what a missing checkout should become (**Half Day** or **Absent**), and what a check-in after the late window should become. Repeated late marks can be marked Half Day or Absent after the count set on the same policy.

### How it works

Worked minutes are the gap from the first punch to the last punch, minus the shift break when the punches cover that break.

- No punches, and the day is not a holiday, weekly off, or approved leave: **Absent**.
- One punch only: **Half Day**, unless the policy says a missing checkout is **Absent**.
- Two punches, and worked minutes are at or below the half-day minimum (when that minimum is greater than zero): **Half Day**.
- Check-in after the grace period but inside the late window: **Late mark**. After the configured number of late marks in the month, payroll can turn the next one into Half Day or Absent.
- Check-in past the late window: Half Day or Absent, whichever the policy's late check-in action says.
- Otherwise the day is a full day.

On a flexible shift, two punches at or under the half-day minimum are Half Day, and longer worked time is a full day. Salary generation treats each half day as 0.5 present and 0.5 loss of pay. The original punches stay in `process_att_logs`. A correction goes through [Regularisation](#regularisation).

### APIs

The threshold is `min_work_hours_half_day_min` on the attendance policy:

- `GET /backend/attendance-policy`
- `POST /backend/attendance-policy`
- `PATCH /backend/attendance-policy/:id`

There is no separate half-day table. The status is calculated when regularisation loads a day and when salary is generated.

## Roster

### Open

1. Tile **Attendance Management**.
2. Tab **Roster** (`/my-company/attendance?tab=roster`).

Standalone page: `/roster`.

### Create

Create the roster, attach employees, then set the shift for each day. The screen uses **Refresh Data** to reload the grid. Assignment is done in the grid rather than a separate "add" modal.

### How it works

On a roster day the roster shift overrides the employee's default shift. Attendance status for that date uses the roster shift.

### APIs

- `GET /backend/rosters`, `POST /backend/rosters`, `PATCH /backend/rosters/:id`
- `GET /backend/roster-employees/select-employees`, `POST /backend/roster-employees`, `POST /backend/roster-employees/attach-all`
- `POST /backend/roster-days`, `POST /backend/roster-days/bulk`

## Regularisation

### Open

Company side:

1. Tile **Attendance Management**.
2. Tab **Regularisation**.
3. **Submit Regularisation**.

Employee side: **My Profile**, attendance or regularisation area, or the manager path **My Team** then **Team Approvals** / `/empTeam/regularisation`.

Standalone page: `/attendance-regularisation`.

### Create

Pick the employee and the date. The form loads that day's punches and status. Enter the corrected in and out time and the reason, then submit. A manager approves or rejects the request.

### How it works

The original punches stay in `process_att_logs`. The request is stored separately. Approved regularisation is what attendance reports and payroll use when they need the corrected day. `GET /backend/process-att-logs` is what the form calls to show the actual punches.

### APIs

- `GET /backend/emp-attendance-regularise/fetch-status` reads the day from `process_att_logs`.
- `POST /backend/emp-attendance-regularise` creates the request. Stored in `EmpAttendanceRegularise`.
- `GET /backend/emp-attendance-regularise` lists requests.
- `GET`, `PATCH`, and `DELETE /backend/emp-attendance-regularise/:id` read, update, or remove one.

## Attendance logs

### Open

Standalone page `/attendance-logs`. The Reports tile has the printable attendance report; see [Reports](#reports).

### How it works

The log board calls `GET /backend/dashboard-overview/today-overview`, which is built from `process_att_logs`. It is a view of punches that already matched an employee. It does not create punches.

### APIs

- `GET /backend/dashboard-overview/today-overview`
- `GET /backend/process-att-logs`

## Mobile and field attendance

### Open

- Mobile punch: employee **Home**, **Check-in**.
- Field site schedule: standalone `/field-attendance-schedule`.
- Photo report: attendance reports can request location photos.

### How it works

A field schedule says where and when an on-field employee is expected. It is not itself a punch. The punch is still the mobile check-in or a device punch. Task site visits are a separate record under Task Management.

### APIs

- `POST /backend/emp-location-attendance/punch`
- `POST /backend/emp-location-attendance/mark-absent`
- `GET /backend/emp-location-attendance/my`
- `GET /backend/emp-location-attendance/today`
- `GET /backend/emp-location-attendance/markout-reminder`
- `GET /backend/emp-location-attendance/photos`
- `GET /backend/emp-field-site-attendance`
- `POST /backend/emp-field-site-attendance`
- `PATCH /backend/emp-field-site-attendance/:id`

## Weekly off and holiday override

### Open

Standalone pages `/employee-weekly-off` and `/employee-holiday-override`. These are employee-level exceptions, not the company holiday calendar.

### Create

Weekly off sets which weekday is off for one employee. Holiday override marks a company holiday as working, or a working day as off, for one employee.

### How it works

Attendance status skips a weekly off or an override the same way it skips a public holiday. The company holiday list itself is under Leave Management.

### APIs

- `GET /backend/employee-weekly-off`, `POST /backend/employee-weekly-off`, `PATCH /backend/employee-weekly-off/:id`
- `GET /backend/employee-holiday-override`, `POST /backend/employee-holiday-override`, `PATCH /backend/employee-holiday-override/:id`

## Overtime

Overtime is calculated from processed punches and the shift. It has no separate "add overtime" form.

- `GET /backend/overtime`
- `POST /backend/overtime/calculate/daily` and `POST /backend/overtime/calculate/range`
- `POST /backend/overtime/recalculate`
- `PATCH /backend/overtime/:id/approve` and `PATCH /backend/overtime/:id/reject`


## Leave applications

### Open

Company side:

1. Sidebar **My Company**.
2. Tile **Leave Management**.
3. Tab **Leave Applications**.
4. **Add Leave Application**.

Employee side: sidebar or mobile **Leave** (`/empLeaveApplication`), then **Apply leave** / **New request**. The form is `/empLeaveApplication/new` or a modal, and the button is **Submit Request**.

Manager side: **My Team**, **Team Approvals** (`/empTeam/approvals`).

Standalone page: `/leave-applications`.

### Create

Choose the leave type from the employee's leave policy, the from and to dates, and the reason. Half-day and short leave follow the options on that form. The employee can open the request again and revoke it while it is still pending.

### How it works

A pending request waits for the reporting manager, or for the approval workflow if one is configured. An approved leave day is excluded from absence in attendance reports and is counted in the employee's leave balance for that policy. The self dashboard "My Leaves" count uses this employee's approved leave in the current company and month.

### APIs

- `GET /backend/leave-application`, `POST /backend/leave-application`, `PATCH /backend/leave-application/:id`
- `PATCH /backend/leave-application/revoke/:id`
- `GET /backend/leave-application-request`, `POST /backend/leave-application-request`, `PATCH /backend/leave-application-request/:id`
- `GET /backend/emp-leave-balance/employee/:id` reads the balance. There is no separate write API; balances move when leave is approved or credited.
- `GET /backend/approval-requests/my-pending`, `POST /backend/approval-requests/:id/approve`, `POST /backend/approval-requests/:id/reject` when the request goes through a workflow.

## Leave policy

### Open

Tile **Leave Management**, tab **Leave Policy**, **Add Leave Policy**.

Also **Policy Management**, tab **Leave Policy**. Standalone page: `/leave-policy`.

### Create

Name the policy and add the leave types (casual, sick, privilege, and any custom type) with the days allowed and whether they carry forward. Assign the policy on the employee form, **Attendance & Leave Policies**.

### How it works

An employee can apply only for types on the assigned policy. The balance API and the leave application form both read this assignment.

### APIs

- `GET /backend/leave-policy`
- `POST /backend/leave-policy`
- `PATCH /backend/leave-policy/:id`

## Holidays

### Open

Tile **Leave Management**, tab **Public Holiday**, **Add Public Holiday**.

Standalone pages: `/public-holiday` and `/manage-holidays`. Employee view: **My Profile** holiday tab, or `/empHolidays`.

### Create

A public holiday has a name, date, and the company or branch it applies to. The employee form's **Holiday Calendar** picks one calendar from `manage-holiday` and stores it on the employee.

### How it works

Attendance treats a holiday date as a holiday instead of an absence, unless that employee has a holiday override. Payroll uses the same calendar when it counts paid days.

### APIs

- `GET /backend/public-holiday`, `POST /backend/public-holiday`, `PATCH /backend/public-holiday/:id`
- `GET /backend/manage-holiday`, `POST /backend/manage-holiday`, `PATCH /backend/manage-holiday/:id`
- `GET /backend/emp-notifications/holidays` is the employee holiday feed.
- `GET /backend/calendar/days` is the read-only calendar used by the home calendar.

## Privileged leave

### Open

Standalone page `/privileged-leave`. It is not a tab on the Leave Management tile.

### Create

**Add PL Entry** records a credit or lapse. **Calculate from Attendance** builds privilege leave from attendance for a period.

### How it works

Privilege leave is a balance on top of the normal leave policy. Credited days become available for privilege leave applications. Lapsed days are removed.

### APIs

- `GET /backend/privileged-leave`, `POST /backend/privileged-leave`, `PATCH /backend/privileged-leave/:id`
- `POST /backend/privileged-leave/credit`
- `POST /backend/privileged-leave/lapse`
- `POST /backend/privileged-leave/calculate-from-attendance`

## Policy Management tile

### Open

1. Sidebar **My Company**.
2. Tile **Policy Management** (`/my-company/policies`).

### How it works

This tile reuses other modules. It does not have its own API.

- **Attendance Policy** is [Attendance policy](#attendance-policy).
- **Work Shift Policy** is [Work shifts](#work-shifts).
- **Offboarding Policy** is [Offboarding](#offboarding).
- **Leave Policy** is [Leave policy](#leave-policy).

This tile is the company's HR policies. It is not the public website terms or privacy pages.

- `GET /backend/company-policies`
- `POST /backend/company-policies` creates or updates a company policy document. There is no separate PATCH.

## Reimbursements

### Open

Company side: tile **Claim & Reimbursement**, tab **Reimbursements**, **Create Reimbursement**. Standalone page: `/reimbursement`.

Employee side: **Reimbursement** (`/empReimbursement`), **New claim**, **Submit Request**.

Manager side: **Team Approvals**.

### Create

Pick the employee (on the company form), the claim date, the expense lines, and the receipts. The employee form submits one claim. The company form can also create a claim on behalf of an employee.

### How it works

A manager approves or rejects each line. Approved amounts can be marked paid and then pulled into payroll. The team dashboard reimbursement tile counts pending claims.

### APIs

- `GET /backend/reimbursement`
- `POST /backend/reimbursement` and `POST /backend/reimbursement/bulk`
- `PATCH /backend/reimbursement/:id`
- `PATCH /backend/reimbursement/:id/items/:itemId/approve`
- `PATCH /backend/reimbursement/:id/items/:itemId/reject`
- `PATCH /backend/reimbursement/:id/items/:itemId/payment`
- `PATCH /backend/reimbursement/:id/payment`
- `PATCH /backend/reimbursement/:id/approval`

## Salary advances

### Open

Company side: tile **Advances & Loan**, tab **Salary Advances**, **Add Salary Advance**. Standalone page: `/salary-advance`.

Employee side: **My Profile**, Loan & Advances, **Request salary advance**, then **Submit request**. The page `/empSalaryAdvance` is the same request.

### Create

Enter the amount, the reason, and the repayment count. After approval, the company disburses the advance and the repayment schedule deducts it from later payroll runs.

### How it works

The team dashboard loan tile counts pending advances. Payroll reads the schedule when it builds deductions for the month.

### APIs

- `GET /backend/salary-advance`, `POST /backend/salary-advance`, `PATCH /backend/salary-advance/:id`
- `POST /backend/salary-advance/:id/schedule`
- `POST /backend/salary-advance/:id/disburse`
- `GET /backend/salary-advance-repayment`, `POST /backend/salary-advance-repayment`, `PATCH /backend/salary-advance-repayment/:id`

## Payroll setup

### Open

1. Sidebar **My Company**.
2. Tile **Payroll Management** (`/my-company/payroll`).

Tabs and buttons, before a salary is generated:

- **Salary Cycle**, **Add Salary Cycle**. Standalone `/monthly-salary-cycle`.
- **Allowances**, **Add Allowance**. Standalone `/salary-allowances`.
- **Deductions**, **Add Deduction**. Standalone `/salary-deductions`.
- **Paygrade**, **Add Paygrade**. Standalone `/monthly-pay-grade`.
- **Bonus Rule**, **Add Bonus Rule**. Standalone `/bonus-setup`.

Bonus amounts for a period are **Bonus Allocations** (`/bonus-allocations`). That page is not a tab on this tile.

### Create

Create the salary cycle, the allowances, the deductions, and the pay grade. On the employee form, **Bank & Payroll** picks the pay grade, payment mode, salary effective date, and bank account. A bonus allocation applies a bonus rule to selected employees for a period.

### How it works

The pay grade is the monthly amount. Allowances add to it and deductions subtract. Salary generation, in the next section, reads this setup together with attendance, leave, advances, and reimbursements.

### APIs

- `GET /backend/salary-cycle`, `POST /backend/salary-cycle`, `PATCH /backend/salary-cycle/:id`
- `GET /backend/salary-allowance`, `POST /backend/salary-allowance`, `PATCH /backend/salary-allowance/:id`
- `GET /backend/salary-deduction`, `POST /backend/salary-deduction`, `PATCH /backend/salary-deduction/:id`
- `GET /backend/monthly-pay-grade`, `POST /backend/monthly-pay-grade`, `PATCH /backend/monthly-pay-grade/:id`
- `GET /backend/hourly-pay-grade`, `POST /backend/hourly-pay-grade`, `PATCH /backend/hourly-pay-grade/:id`
- `GET /backend/bonus-setup`, `POST /backend/bonus-setup`, `PATCH /backend/bonus-setup/:id`
- `GET /backend/bonus-allocation`, `POST /backend/bonus-allocation`, `PATCH /backend/bonus-allocation/:id`

## Salary generation

### Open

1. Sidebar **My Company**.
2. Tile **Payroll Management**.
3. Tab **Run Payroll**.
4. **Add Run Payroll**.

Standalone page: `/generate-salary`. The same generator for a company user on the employee shell is `/empGenerateSalary`.

### Create

Select the salary cycle and the employees. Generate writes one salary row per employee for that period. The row stores payable days, loss of pay, allowances, deductions, and net pay.

### How it works

For each day in the cycle the generator reads `process_att_logs`, the shift, and the attendance policy. A full day counts as 1, a half day as 0.5, and an absent day as 0. Approved leave and holidays stay paid. Loss of pay is absent days plus half days times 0.5. Approved advances add a deduction from the repayment schedule. Approved reimbursements can be added as pay. The employee then opens the row under [Payslips](#payslips). There is no second payslip API.

### APIs

- `GET /backend/generate-salary` lists generated rows.
- `POST /backend/generate-salary` creates a run.
- `PATCH /backend/generate-salary/:id` updates a row.

## Payslips

### Open

Employee **Payout** (`/empPayout`). Open one slip at `/empPayout/:id`. **Submit query** on that slip sends a question about the amount.

### How it works

Payslips are the generated salary rows for the signed-in employee. There is no separate payslip create button. Run Payroll creates them.

### APIs

Payslips read `GET /backend/generate-salary` scoped to the employee. There is no second payslip controller.

## Reports

### Open

1. Tile **Reports** (`/my-company/reports`).
2. Tabs **Attendance Reports**, **Leave Reports**, **Payroll Reports**, **Contractor Reports**.
3. **Generate Report** on each tab.

Standalone pages: `/attendance-reports`, `/leave-reports`, `/payroll-reports`, `/contractor-reports`.

### How it works

There is no reports controller. Each report reads the module that already stored the data.

- Attendance reports read `GET /backend/process-att-logs`, regularisation, leave, shifts, roster, and location photos.
- Leave reports read leave applications and leave policy.
- Payroll reports read generated salary, allowances, deductions, and advances.
- Contractor reports read contractors and contractor payouts.

### APIs

Use the list APIs of those modules. Dashboard helpers used by some report headers:

- `GET /backend/dashboard-overview/today-overview`
- `GET /backend/dashboard-overview/hr-widgets`
- `GET /backend/dashboard-overview/new-joiners`
- `GET /backend/dashboard-overview/probation-alerts`

## Statutory PF, ESI, and PT

### Open

Standalone `/statutory-reports` opens the PF, ESI, and PT challan pages: `/pf-compliance`, `/esic-compliance`, `/pt-compliance`.

Company compliance rules are also under system settings, **Compliance**, **Add Rule**, and under the hidden Tax & Compliance tile.

### Create

Enter the establishment's PF, ESI, or professional-tax registration against the company (and the branch, for PT). The employee form stores whether EPF or ESI applies to that person, plus UAN, PF member id, and ESIC number.

### How it works

Payroll and the statutory report use the company registration and the employee flags together. A person with EPF unticked is left out of the PF challan even if an old number is still in the database; saving with the box unticked clears the number.

### APIs

- `GET /backend/pf-compliance`, `POST /backend/pf-compliance`, `PATCH /backend/pf-compliance/:companyID`
- `GET /backend/esic-compliance`, `POST /backend/esic-compliance`, `PATCH /backend/esic-compliance/:companyID`
- `GET /backend/pt-compliance`, `POST /backend/pt-compliance`, `PATCH /backend/pt-compliance/:companyID/:branchID`
- `GET /backend/compliance-rules`, `POST /backend/compliance-rules`, `PATCH /backend/compliance-rules/:id`


## Contractors

### Open

1. Sidebar **My Company**.
2. Tile **Contract Management**.
3. Tab **Contractors**.
4. **Add Contractor**.

Standalone pages: `/contractors`, `/contractor-rates`, `/contract-employee`, `/contractor-payout`.

### Create

**Add Contractor** stores the contractor name and contact for the company. On the contractor record, rate cards say what the company pays for that contractor's people. **Add Contractor Rates** is the rate-card action. Contract employees are employees whose employment type is Contract; they are listed on `/contract-employee`. **Generate Statement** on contractor payout builds the payable statement for a period.

### How it works

A contract employee is still an employee record. Attendance punches and leave apply the same way. Payroll for a contractor-paid employee is grouped into the contractor statement instead of the company payslip run.

### APIs

- `GET /backend/contractors`, `POST /backend/contractors`, `PATCH /backend/contractors/:id`
- `POST /backend/contractors/:id/rate-cards`
- `GET /backend/contractor-payout`, `POST /backend/contractor-payout`, `PATCH /backend/contractor-payout/:id`

## Tasks

### Open

Sidebar **Task Management**, or `/my-company/tasks`, tab **Tasks**. **Create Task**.

Employees who only have task access use `/task-projects` or `/empMyTasks`. **Create task** opens the **New task** modal. On a task they can record a visit or **Request Exception**.

### Create

A task has a title, customer, site, assignee, priority, and dates. Status moves through open, in progress, and closed. Remarks, chat, and a site visit are added on the task after it exists.

### How it works

The assignee sees the task on My Tasks. A site visit can record field attendance for that visit (`POST /backend/task-projects/field-attendance`). That visit is not a substitute for the device or mobile punch described in [How punches are stored](#how-punches-are-stored). ENPL integration can create tasks from outside the form.

### APIs

- `GET /backend/task-projects`, `POST /backend/task-projects`, `PATCH /backend/task-projects/:id`
- `PATCH /backend/task-projects/:id/status`, `PATCH /backend/task-projects/:id/priority`, `PATCH /backend/task-projects/:id/assign`
- `POST /backend/task-projects/:id/remarks`
- `POST /backend/task-projects/:id/chats`
- `POST /backend/task-projects/:id/site-visit`
- `POST /backend/task-projects/:id/assignment-action`
- `POST /backend/task-projects/field-attendance`
- `POST /backend/task-projects/sync-from-enpl`
- External create: `POST /backend/api/integrations/enpl/tasks` and `POST /backend/api/integrations/enpl/bulk-import`. `GET /backend/api/integrations/enpl/health` is the health check.

## CRM customers and sites

### Open

Sidebar **CRM**, or `/my-company/cr`.

- Tab **Customers**, **Add Customer**. Standalone `/task-customers`.
- Tab **Sites**, **Add Site**. Standalone `/task-customer-sites`.

### Create

A customer is the account. A site is a branch or location under that customer, with the address used for on-field tasks. Create the customer first, then the site, then the task that points at both.

### How it works

Task assignment and site visits use the site. Employees without company access who still have tasks see Customers and Sites in the sidebar instead of the My Company tile.

### APIs

- `GET /backend/task-customers`, `POST /backend/task-customers`, `PATCH /backend/task-customers/:id`
- `GET /backend/task-customer-sites`, `POST /backend/task-customer-sites`, `PATCH /backend/task-customer-sites/:id`
- External create: `POST /backend/api/integrations/enpl/customers` and `POST /backend/api/integrations/enpl/sites`

## Employee home and profile

### Open

- **Home** is `/empdashboard`. The view switch defaults to **Self** every time the dashboard is opened. **My Team** on that switch stays only while the user remains on the dashboard.
- **My Profile** is `/empProfile`.
- **My Calendar** is `/empdashboard?tab=calendar`.

### How it works

**Self** shows the greeting, **Check-in**, **Mark Absent**, leave balance, this month's attendance, tasks, and the approval tiles (regularisation, reimbursement, loan). Those tiles link to the employee's own requests. Punch storage is [Mobile check-in](#how-punches-are-stored).

Profile tabs are Profile, Attendance, Work Report, Leave, Reimbursement, Regularisation, Payslip, Loan & Advances, My Holidays, and My Delegations. Each tab reads the module of the same name. They do not create a second copy of the data.

Mobile bottom navigation: Home, Attendance (`/empProfile?tab=attendance`), Leave, Reimbursement, Payout, and, when enabled, Tasks and Team.

### APIs

Home and profile call the module APIs already listed:

- Check-in: `POST /backend/emp-location-attendance/punch`
- Layout of the home cards: `GET /backend/dashboard-layout`, `PUT /backend/dashboard-layout`
- Delegations: `GET /backend/emp-manager-scope/reportees`, `POST /backend/emp-manager-scope/delegations`

## My Team and approvals

### Open

Managers see **My Team**, **Team Approvals**, and **Promotions & Transfers** under Team Management.

- My Team: `/empTeam/my-team`, and one person at `/empTeam/member/:id`.
- Team Approvals: `/empTeam/approvals`. Approve or reject, or **New request** for the manager's own leave, reimbursement, or promotion.
- Team regularisation: `/empTeam/regularisation`.

### How it works

My Team lists direct reports from the reporting manager set on the employee form. Approvals are the pending leave, reimbursement, regularisation, and loan requests for those people. The team dashboard on Home uses the same counts, with one tile each for leave (blue), reimbursement (purple), regularisation (green), and loan (blue). There is no check-in button on the team view.

### APIs

The approval screen uses the leave, reimbursement, regularisation, salary-advance, and promotion list APIs, plus:

- `POST /backend/approval-requests/:id/approve`
- `POST /backend/approval-requests/:id/reject`
- `GET /backend/approval-requests/my-pending`

## Internal messaging

### Open

Sidebar **IM**, which is `/empProfile?tab=messaging`. The admin memo page is `/employee-memo`.

### Create

**Send message** for a direct message. **Create group** for a group. A manager notice uses **Send notice / warning**.

### How it works

Messages stay in the memo thread. They do not change attendance or leave. Replies and undo are actions on an existing memo.

### APIs

- `GET /backend/employee-memo`, `POST /backend/employee-memo`, `PATCH /backend/employee-memo/:id`
- `POST /backend/employee-memo/:id/reply`
- `POST /backend/employee-memo/:id/undo`

## Approval workflows

### Open

The Workflow Management tile is hidden from the tile menu. The screen is `/my-company/workflow` and the standalone page `/approval-workflows`. **Create Approval Workflow**.

### Create

Pick the module (leave, reimbursement, or another request type), the company, and the approval steps.

### How it works

When a workflow is active, a new request creates an approval request for the next step instead of going only to the reporting manager. Approvers use Team Approvals or the pending list.

### APIs

- `GET /backend/approval-workflows`, `POST /backend/approval-workflows`, `PATCH /backend/approval-workflows/:id`, `PATCH /backend/approval-workflows/:id/status`
- `GET /backend/approval-requests/my-pending`, `POST /backend/approval-requests/:id/approve`, `POST /backend/approval-requests/:id/reject`

## Coming soon

These tiles or tabs are in the hub list and have no working create flow.

- **Onboarding** (`/my-company/onboarding`) is hidden. Candidate List and Onboarding open new joiners and link to **Manage employees**. Assessments, Interviews, Offers, and Under Review are coming soon. The employee onboarding page `/empOnboarding` is a checklist with no save API.
- **Documents & Templates** is hidden. Document Templates and Forms are coming soon. Email Templates can be edited and saved with `POST /backend/email-template`.
- **Tax & Compliance** is hidden. Company Information and Registrations & Certificates reuse company profile and compliance rules.
- **CRM** at `/my-company/crm` is a second, coming-soon CRM tile. The working CRM is [CRM customers and sites](#crm-customers-and-sites).
- **Asset Management** is coming soon. There is no asset API.
- **Other Policy** (`/other-policy`) is the IT-policy page and is not a My Company tab.

## Database schema

PostgreSQL tables from the HRMS schema. The heading is the table name. When the physical name differs, it is written on that same heading. Each line is one column: name, type, then a primary key, unique, or foreign key when the column has one.

### Company

```
Company
id                              int      primary key
serviceProviderID               int
companyName                     varchar
address                         varchar
country                         varchar
state                           varchar
city                            varchar
pincode                         varchar
timeZone                        varchar
currency                        varchar
pfNo                            varchar
panNo                           varchar
tanNo                           varchar
esiNo                           varchar
linNo                           varchar
gstNo                           varchar
gstCertUrl                      varchar
website                         varchar
gstRegistrationType             varchar
businessTradeName               varchar
shopRegNo                       varchar
shopRegCertHistory              json
financialYearStart              varchar
contactNo                       varchar
emailAdd                        varchar
companyLogoUrl                  varchar
SignatureUrl                    varchar
companyType                     varchar
legalEntityType                 varchar
defaultOwnerTitle               varchar
noticePeriodDaysForResignation  varchar
noticePeriodDaysForTermination  varchar
pwaShowLeaveBalance             boolean
```

```
Branches
id                  int      primary key
serviceProviderID   int
companyID           int      foreign key -> Company.id
branchName          varchar
address             varchar
country             varchar
state               varchar
city                varchar
pincode             varchar
timeZone            varchar
currency            varchar
pfNo                varchar
tanNo               varchar
esiNo               varchar
linNo               varchar
gstNo               varchar
gstCertUrl          varchar
msmeNo              varchar
msmeCertUrl         varchar
shopRegNo           varchar
shopRegCertHistory  json
financialYearStart  varchar
contactNo           varchar
emailAdd            varchar
companyLogoUrl      varchar
SignatureUrl        varchar
branchType          varchar
latitude            varchar
longitude           varchar
geofenchradius      varchar
placeId             varchar
locationSource      varchar
locationVerified    boolean
```

```
CompanyFederalDomain
id                    int        primary key
companyID             int        unique with code, foreign key -> Company.id
code                  varchar    unique with companyID
createdAt             timestamp
updatedAt             timestamp
```

```
Module
id           int        primary key
moduleKey    varchar    unique
moduleName   varchar
description  varchar
isActive     boolean
sortOrder    int
createdAt    timestamp
updatedAt    timestamp
```

```
CompanyModule
id             int        primary key
companyID      int        unique with moduleID, foreign key -> Company.id
moduleID       int        unique with companyID, foreign key -> Module.id
isEnabled      boolean
createdAt      timestamp
updatedAt      timestamp
```

```
CompanyModules    table company_modules
id                                       int        primary key
moduleKey                                text
moduleName                               text
moduleDescription                        text
moduleStatus                             boolean
createdAt                                timestamp
updatedAt                                timestamp
```

```
Departments
id                  int      primary key
serviceProviderID   int
companyID           int      foreign key -> Company.id
branchesID          int      foreign key -> Branches.id
parentDepartmentID  int      foreign key -> Departments.id
departmentName      varchar
```

```
DepartmentBranch
id                int  primary key
departmentID      int  unique with branchesID, foreign key -> Departments.id
branchesID        int  unique with departmentID, foreign key -> Branches.id
```

```
Designations
id                              int      primary key
serviceProviderID               int
companyID                       int      foreign key -> Company.id
branchesID                      int      foreign key -> Branches.id
departmentID                    int      foreign key -> Departments.id
parentDesignationID             int      foreign key -> Designations.id
designation                     varchar
isManager                       boolean
maxHoursPerDay                  varchar
nightShiftEligibility           varchar
noticePeriodDaysForResignation  varchar
noticePeriodDaysForTermination  varchar
shiftEligibility                varchar
weeklyOffPattern                varchar
otApplicable                    varchar
```

```
ComplianceRule
id                 int        primary key
serviceProviderID  int
companyID          int        foreign key -> Company.id
ruleText           text
isActive           boolean
createdAt          timestamp
updatedAt          timestamp
```

```
User
id                 int        primary key
username           text       unique
passwordHash       text
role               UserRole
firstName          text
lastName           text
contactNo          text
email              text
requireLoginOtp    boolean
serviceProviderID  int
companyID          int        foreign key -> Company.id
branchesID         int        foreign key -> Branches.id
contractorID       int        foreign key -> Contractors.id
isActive           boolean
createdAt          timestamp
updatedAt          timestamp
```

```
UserCompany
id           int        primary key
userID       int        unique with companyID, foreign key -> User.id
companyID    int        unique with userID, foreign key -> Company.id
isPrimary    boolean
createdAt    timestamp
```

```
UserProfile
id           int        primary key
userId       int        unique, foreign key -> User.id
fullName     varchar
email        varchar
mobileNo     varchar
address      varchar
city         varchar
state        varchar
pincode      varchar
createdAt    timestamp
updatedAt    timestamp
```

```
EmployeeModulePermission    table employee_module_permissions
id                                                             int        primary key
companyID                                                      int        unique with manageEmployeeID, moduleKey, foreign key -> Company.id
manageEmployeeID                                               int        unique with companyID, moduleKey, foreign key -> ManageEmployee.id
moduleKey                                                      varchar    unique with companyID, manageEmployeeID
canView                                                        boolean
canCreate                                                      boolean
canEdit                                                        boolean
canDelete                                                      boolean
createdAt                                                      timestamp
updatedAt                                                      timestamp
```

```
EmployeeCredentials
id                   int        primary key
employeeID           int        unique, foreign key -> ManageEmployee.id
username             varchar    unique
password             varchar
mustChangePassword   boolean
requireLoginOtp      boolean
passwordChangedAt    timestamp
serviceProviderID    int
companyID            int        foreign key -> Company.id
branchesID           int        foreign key -> Branches.id
isActive             boolean
createdAt            timestamp
updatedAt            timestamp
```

### Employees

```
ManageEmployee
id                              int                      primary key
serviceProviderID               int
companyID                       int                      unique with employeeID, foreign key -> Company.id
branchesID                      int                      foreign key -> Branches.id
employeeFirstName               varchar
employeeMiddleName              varchar
employeeLastName                varchar
employeeID                      varchar                  unique with companyID
joiningDate                     varchar
contractorID                    int                      foreign key -> Contractors.id
salaryPayoutTo                  varchar
businessPhoneNo                 varchar
businessEmail                   varchar
personalPhoneNo                 varchar
personalEmail                   varchar
emergancyContact                varchar
emergencyContacts               json
presentAddress                  varchar
presentCity                     varchar
presentState                    varchar
presentPincode                  varchar
presentCountry                  varchar
permanentSameAsCurrent          boolean
permenantAddress                varchar
employeePhotoUrl                varchar
gender                          varchar
numberOfChildren                int
dateOfBirth                     varchar
bloodGroup                      varchar
maritalStatus                   varchar
employeeFatherName              varchar
employeeMotherName              varchar
employeeSpouseName              varchar
departmentNameID                int                      foreign key -> Departments.id
designationID                   int                      foreign key -> Designations.id
employmentType                  varchar
employmentStatus                varchar
probationPeriod                 varchar
workShiftID                     int                      foreign key -> WorkShift.id
attendancePolicyID              int                      foreign key -> AttendancePolicy.id
leavePolicyID                   int                      foreign key -> leavePolicy.id
salaryPayGradeType              varchar
monthlyPayGradeID               int                      foreign key -> MonthlyPayGrade.id
hourlyPayGradeID                int                      foreign key -> HourlyPayGrade.id
empType                         varchar
exitDate                        timestamp
isDeleted                       boolean
isCompanyOwner                  boolean
ownerTitle                      varchar
salutation                      varchar
lifecycleStatus                 EmployeeLifecycleStatus
onboardingApprovalStatus        ApprovalRequestStatus
maxHoursPerDay                  varchar
nightShiftEligibility           varchar
noticePeriodDaysForResignation  varchar
noticePeriodDaysForTermination  varchar
pfMemberStatus                  varchar
pfNumber                        varchar
aadharNo                        varchar
panNo                           varchar
uanNo                           varchar
esiNo                           varchar
esiApplies                      boolean
paymentMode                     varchar
salaryEffectiveDate             varchar
holidayCalendarID               int
privacyReview                   json
shiftEligibility                varchar
typeOfEmployee                  varchar
weeklyOffPattern                varchar
salaryCycleID                   int                      foreign key -> SalaryCycle.id
allowRotatingShift              boolean
allowCreateTaskOnMobile         boolean
pwaShowLeaveBalance             boolean
pwaShowLoanAdvances             boolean
mobileAttendanceEnabled         boolean
mobileBreakEnabled              boolean
photoPunchEnabled               boolean
wfhAllowed                      boolean
wfhHomeAddress                  text
wfhHomeLatitude                 float
wfhHomeLongitude                float
placeId                         varchar
locationSource                  varchar
locationVerified                boolean
amc                             boolean
```

```
EmployeeDocument    table employee_documents
id                                            int        primary key
employeeID                                    int        foreign key -> ManageEmployee.id
serviceProviderID                             int
companyID                                     int        foreign key -> Company.id
branchesID                                    int        foreign key -> Branches.id
documentName                                  varchar
documentCategory                              varchar
description                                   varchar
issuedDate                                    timestamp
expiryDate                                    timestamp
fileName                                      varchar
fileUrl                                       varchar
fileType                                      varchar
fileSize                                      int
isActive                                      boolean
createdAt                                     timestamp
updatedAt                                     timestamp
```

```
EmployeeBankDetails    table employee_bank_details
id                                                  int      primary key
employeeID                                          int      foreign key -> ManageEmployee.id
bankName                                            varchar
bankBranchName                                      varchar
accountHolderName                                   varchar
accNumber                                           varchar
ifscCode                                            varchar
upi                                                 varchar
```

```
BankDetails
id                 int      primary key
serviceProviderID  int
companyID          int      foreign key -> Company.id
branchesID         int      foreign key -> Branches.id
bankName           varchar
bankBranchName     varchar
accountNo          varchar
ifscCode           varchar
```

```
EmployeeFieldHistory
id                    int        primary key
employeeId            int        foreign key -> ManageEmployee.id
fieldName             varchar
oldValue              varchar
newValue              varchar
oldLabel              varchar
newLabel              varchar
changedAt             timestamp
```

```
EmployeeLink
id                int  primary key
employeeId        int  unique with linkedEmployeeId, foreign key -> ManageEmployee.id
linkedEmployeeId  int  unique with employeeId, foreign key -> ManageEmployee.id
```

```
EmployeeTermination
id                   int         primary key
employeeId           int         foreign key -> ManageEmployee.id
serviceProviderID    int
companyID            int
branchesID           int
exitType             ExitType
exitStatus           ExitStatus
reasonCategory       text
reasonNote           text
noticeDays           int
noticeStartDate      timestamp
lastWorkingDay       timestamp
resignationDate      timestamp
approvalDate         timestamp
disableLoginOn       timestamp
isRehireEligible     boolean
createdByUserId      int
createdAt            timestamp
updatedAt            timestamp
```

```
EmpEduQualification
id                   int      primary key
manageEmployeeID     int      foreign key -> ManageEmployee.id
instituteType        varchar
instituteName        varchar
degree               varchar
pasingYear           varchar
marks                varchar
gpaCgpa              varchar
class                varchar
```

```
EmpProfExprience
id                int      primary key
manageEmployeeID  int      foreign key -> ManageEmployee.id
orgName           varchar
designation       varchar
fromDate          varchar
toDate            varchar
responsibility    varchar
skill             varchar
```

```
EmpDesignation
id                int      primary key
manageEmployeeID  int      foreign key -> ManageEmployee.id
designationID     int      foreign key -> Designations.id
effectFrom        varchar
```

```
EmpBranch
id                int      primary key
manageEmployeeID  int      foreign key -> ManageEmployee.id
branchesID        int      foreign key -> Branches.id
effectFrom        varchar
```

```
EmpDepartment
id                int      primary key
manageEmployeeID  int      foreign key -> ManageEmployee.id
departmentNameID  int      foreign key -> Departments.id
effectFrom        varchar
```

```
EmpEmploymentType
id                 int      primary key
manageEmployeeID   int      foreign key -> ManageEmployee.id
employmentType     varchar
effectFrom         varchar
```

```
EmpEmploymentStatus
id                   int      primary key
manageEmployeeID     int      foreign key -> ManageEmployee.id
employmentStatus     varchar
probationPeriod      varchar
effectFrom           varchar
```

```
EmpCurrentPosition
id                         int        primary key
serviceProviderID          int
companyID                  int        foreign key -> Company.id
branchesID                 int        foreign key -> Branches.id
manageEmployeeID           int        foreign key -> ManageEmployee.id
existingDepartmentID       int        foreign key -> Departments.id
existingDesignationID      int        foreign key -> Designations.id
existingMonthlyPayGradeID  int        foreign key -> MonthlyPayGrade.id
existingHourlyPayGradeID   int        foreign key -> HourlyPayGrade.id
existingSalaryCtc          int
existingEmploymentType     int
effectiveFrom              date
effectiveTo                date
createdAt                  timestamp
```

```
PromotionRequest
id                         int          primary key
manageEmployeeID           int          foreign key -> ManageEmployee.id
empID                      varchar
newDepartmentID            int          foreign key -> Departments.id
newDesignationID           int          foreign key -> Designations.id
newMonthlyPayGradeID       int          foreign key -> MonthlyPayGrade.id
newHourlyPayGradeID        int          foreign key -> HourlyPayGrade.id
newSalaryCtc               int
newEmploymentType          int
newEmployementStatus       varchar
proposedDepartmentID       int          foreign key -> Departments.id
proposedDesignationID      int          foreign key -> Designations.id
proposedMonthlyPayGradeID  int          foreign key -> MonthlyPayGrade.id
proposedHourlyPayGradeID   int          foreign key -> HourlyPayGrade.id
proposedSalaryCtc          int
proposedEmploymentType     int
description                varchar
promotionDate              date
status                     varchar
applied_at                 timestamptz
approved_at                timestamptz
updated_at                 timestamptz
```

```
EmpPromotion
id                  int      primary key
manageEmployeeID    int      foreign key -> ManageEmployee.id
serviceProviderID   int
companyID           int      foreign key -> Company.id
branchesID          int      foreign key -> Branches.id
departmentNameID    int      foreign key -> Departments.id
designationID       int      foreign key -> Designations.id
managerID           int
employmentType      varchar
employmentStatus    varchar
probationPeriod     varchar
workShiftID         int      foreign key -> WorkShift.id
attendancePolicyID  int      foreign key -> AttendancePolicy.id
leavePolicyID       int      foreign key -> leavePolicy.id
salaryPayGradeType  varchar
monthlyPayGradeID   int      foreign key -> MonthlyPayGrade.id
hourlyPayGradeID    int      foreign key -> HourlyPayGrade.id
promotedSalaryCtc   int
description         varchar
promotionDate       date
status              varchar
```

```
EmployeeDelegation
id                  int          primary key
delegatorId         int          foreign key -> ManageEmployee.id
delegateeId         int          foreign key -> ManageEmployee.id
delegationType      varchar
startDate           date
endDate             date
notification        varchar
description         varchar
status              varchar
isDeleted           boolean
companyID           int
branchesID          int
serviceProviderID   int
createdAt           timestamptz
updatedAt           timestamptz
```

### Attendance

```
Devices
id                 int           primary key
status             DeviceStatus
serviceProviderID  int
companyID          int           foreign key -> Company.id
branchesID         int           foreign key -> Branches.id
deviceName         varchar
deviceMake         varchar
deviceModel        varchar
deviceSN           text
createdAt          timestamp
updatedAt          timestamp
deviceType         varchar
latitude           float
longitude          float
address            text
```

```
EmpDeviceMapping
id                int      primary key
manageEmployeeID  int      foreign key -> ManageEmployee.id
deviceID          int      foreign key -> Devices.id
deviceEmpCode     varchar
authType          varchar
```

```
TokenDeviceMapping
id                  int      primary key
manageEmployeeID    int      foreign key -> ManageEmployee.id
deviceID            int      foreign key -> Devices.id
deviceEmpCode       varchar
authType            varchar
```

```
AttendanceLogs
id              int        primary key
deviceId        int        foreign key -> Devices.id
deviceSN        varchar
userId          varchar
logTime         varchar
status          varchar
workCode        varchar
rawData         text
authType        varchar
processed       varchar
createdAt       timestamp
```

```
EmpAttendanceLogs
id                 int        primary key
serviceProviderID  int
companyID          int
branchesID         int
deviceID           int
employeeID         int
punchTimeStamp     varchar
latitude           int
longitude          int
googleMapLink      int
location           int
mobileDeviceID     int
mobileDeviceInfo   int
exported           int
createdAt          timestamp
```

```
essl_raw_attlog
id               int        primary key
device_sn        text
request_path     text
query_params     text
raw_body         text
ip_address       text
is_valid         boolean
created_at       timestamp
log_type         varchar
user_id          varchar
punch_time       varchar
auth_type        varchar
export           int
```

```
process_att_logs
id                  int        primary key
device_sn           varchar
user_id             varchar
username            varchar
punch_time          timestamp
company_name        varchar
branch_name         varchar
department_name     varchar
device_emp_code     varchar
manage_employee_id  int
device_id           int
raw_body            text
processed_at        timestamp
status              varchar
device_name         varchar
device_type         varchar
auth_type           varchar
```

```
AttendanceLocation    table attendance_locations
id                                                int        primary key
employeeId                                        int        foreign key -> ManageEmployee.id
checkType                                         varchar
latitude                                          float
longitude                                         float
accuracy                                          float
address                                           text
ipAddress                                         varchar
deviceType                                        varchar
browser                                           varchar
operatingSystem                                   varchar
userAgent                                         text
photoUrl                                          varchar
fenceType                                         varchar
fenceSiteId                                       int
companyID                                         int
branchesID                                        int
serviceProviderID                                 int
checkinTime                                       timestamp
createdAt                                         timestamp
updatedAt                                         timestamp
```

```
EmpFieldSiteAttendance
id                      int        primary key
serviceProviderID       int
companyID               int        foreign key -> Company.id
branchesID              int        foreign key -> Branches.id
manageEmployeeID        int        foreign key -> ManageEmployee.id
siteName                varchar
address                 varchar
latitude                varchar
longitude               varchar
fromDate                timestamp
toDate                  timestamp
```

```
EmpAbsentDeclaration
id                    int        primary key
employeeId            int        unique with absentDate, foreign key -> ManageEmployee.id
absentDate            date       unique with employeeId
reason                text
leaveType             varchar
leaveApplicationId    int
createdAt             timestamp
```

```
AttendancePolicy
id                                      int      primary key
serviceProviderID                       int
companyID                               int      foreign key -> Company.id
branchesID                              int      foreign key -> Branches.id
attendancePolicyName                    varchar
workingHoursType                        varchar
checkin_begin_before_min                int
checkout_end_after_min                  int
checkin_grace_time_min                  int
earlyCheckoutBeforeEndMin               int
min_work_hours_half_day_min             int
max_late_check_in_time                  int
markAs                                  text
lateMarkCount                           text
allow_self_mark_attendance              boolean
allow_manager_update_ot                 boolean
max_ot_hours_per_day_min                int
checkoutGracePeriodForOvertimeTrimming  int
breakTimeForOT                          int
otMealApply                             boolean
maxOvertimeHrs                          int
minOvertimeHrs                          int
countWorkhoursInMinutes                 boolean
overtimeApplicable                      boolean
overtimeTrimmingApply                   boolean
minsForOTMealToken                      int
minsForBreakTimeForMeal                 int
leaveAroundHolidayCounted               boolean
lateMarkMarkAs                          text
lateMarkMarkCount                       text
maxLateCheckinMarkAs                    text
trimPreshiftMin                         int
trimPostshiftMin                        int
```

```
EmpAttendancePolicy
id                   int      primary key
manageEmployeeID     int      foreign key -> ManageEmployee.id
attendancePolicyID   int      foreign key -> AttendancePolicy.id
effectFrom           varchar
```

```
WorkShift
id                 int      primary key
serviceProviderID  int
companyID          int      foreign key -> Company.id
branchesID         int      foreign key -> Branches.id
workShiftName      varchar
isActive           varchar
workShiftType      varchar
isFlexible         boolean
isRotating         boolean
breakTimeMin       int
```

```
WorkShiftDay
id            int      primary key
workShiftID   int      foreign key -> WorkShift.id
weekDay       varchar
shiftType     varchar
weeklyOff     boolean
startTime     text
endTime       text
breakStart    text
breakEnd      text
totalMinutes  int
```

```
EmpWorkShift
id                int      primary key
manageEmployeeID  int      foreign key -> ManageEmployee.id
workShiftID       int      foreign key -> WorkShift.id
effectFrom        varchar
```

```
Roster
id                 int        primary key
serviceProviderID  int
companyID          int        foreign key -> Company.id
branchesID         int        foreign key -> Branches.id
departmentID       int        foreign key -> Departments.id
designationID      int        foreign key -> Designations.id
fromDate           timestamp
toDate             timestamp
rosterPeriod       text
status             text
createdBy          int
createdAt          timestamp
updatedAt          timestamp
```

```
RosterEmployee
id              int  primary key
rosterID        int  unique with employeeID, foreign key -> Roster.id
employeeID      int  unique with rosterID, foreign key -> ManageEmployee.id
```

```
RosterDay
id                int        primary key
rosterEmployeeID  int        unique with workDate, foreign key -> RosterEmployee.id
workDate          timestamp  unique with rosterEmployeeID
workShiftID       int        foreign key -> WorkShift.id
dayType           text
leaveType         text
isLocked          boolean
```

```
EmpAttendanceRegularise
id                       int               primary key
serviceProviderID        int
companyID                int               foreign key -> Company.id
branchesID               int               foreign key -> Branches.id
departmentID             int               foreign key -> Departments.id
manageEmployeeID         int               unique with attendanceDate, foreign key -> ManageEmployee.id
attendanceDate           date              unique with manageEmployeeID
day                      text
checkInTime              timestamp
checkOutTime             timestamp
actualStatus             AttendanceStatus
requestedStatus          RegularizeAs
reason                   varchar
remarks                  varchar
status                   varchar
overtimeApplicable       boolean
otMealApply              boolean
otMealMinutes            int
otBreakMinutes           int
createdAt                timestamp
updatedAt                timestamp
```

```
EmployeeHolidayOverride
id                       int        primary key
serviceProviderID        int
companyID                int
branchesID               int
employeeID               int        foreign key -> ManageEmployee.id
holidayId                int        foreign key -> PublicHoliday.id
fromDate                 date
toDate                   date
reason                   varchar
createdAt                timestamp
updatedAt                timestamp
```

```
EmployeeWeeklyOff
id                 int        primary key
serviceProviderID  int
companyID          int
branchesID         int
employeeID         int        foreign key -> ManageEmployee.id
date               date
createdAt          timestamp
```

```
Overtime
id                 int        primary key
serviceProviderID  int
companyID          int
branchesID         int
employeeID         int        foreign key -> ManageEmployee.id
workShiftID        int        foreign key -> WorkShift.id
workDate           timestamp
shiftStartTime     timestamp
shiftEndTime       timestamp
punchOutTime       timestamp
otStartTime        timestamp
otEndTime          timestamp
otMinutes          int
otHours            float
otRate             text
status             OTStatus
rejectionReason    text
createdAt          timestamp
updatedAt          timestamp
```

```
CalendarDay
id           int        primary key
year         int
month        int
day          int
isoDate      timestamp  unique
weekday      text
createdAt    timestamp
updatedAt    timestamp
```

```
Holiday
id         int        primary key
name       text
slug       text       unique
region     text
type       text
notes      text
createdAt  timestamp
updatedAt  timestamp
```

```
HolidayOnDay
id             int  primary key
calendarDayId  int  unique with holidayId, foreign key -> CalendarDay.id
holidayId      int  unique with calendarDayId, foreign key -> Holiday.id
```

### Leave

```
leavePolicy
id                           int      primary key
serviceProviderID            int
companyID                    int      foreign key -> Company.id
branchesID                   int      foreign key -> Branches.id
leavePolicyName              varchar
sickLeaveCount               varchar
casualLeaveCount             varchar
maternityLeaveCount          varchar
paternityLeaveCount          varchar
earnLeaveWorkingMonths       varchar
earnLeaveCount               int
isPrivilegedLeaveApplicable  boolean
privilegedLeaveRatio         varchar
weekOffConsideredInPL        boolean
holidayConsideredInPL        boolean
paidLeaveConsideredInPL      boolean
plCarryForwardLimit          int
lapseEncashmentDate          date
```

```
leavePolicyHoliday
id                  int  primary key
serviceProviderID   int
companyID           int  foreign key -> Company.id
branchesID          int  foreign key -> Branches.id
leavePolicyID       int  foreign key -> leavePolicy.id
publicHolidayID     int  foreign key -> PublicHoliday.id
```

```
leaveApplication
id                    int        primary key
serviceProviderID     int
companyID             int        foreign key -> Company.id
branchesID            int        foreign key -> Branches.id
manageEmployeeID      int        foreign key -> ManageEmployee.id
remainingSickLeave    int
remainingCasualLeave  int
remainingEarnedLeave  int
dayStatuses           json
revokedAt             timestamp
revokedReason         text
appliedLeaveType      varchar
childNumber           varchar
birthEventDate        varchar
fromDate              date
toDate                date
purpose               varchar
status                varchar
```

```
leaveApplicationRequest
id                       int      primary key
serviceProviderID        int
companyID                int      foreign key -> Company.id
branchesID               int      foreign key -> Branches.id
leaveApplicationID       int      foreign key -> leaveApplication.id
leaveApplicationStatus   varchar
```

```
EmpLeavePolicy
id                int      primary key
manageEmployeeID  int      foreign key -> ManageEmployee.id
leavePolicyID     int      foreign key -> leavePolicy.id
effectFrom        varchar
```

```
EmpLeaveBalance
id                int        primary key
manageEmployeeID  int        unique, foreign key -> ManageEmployee.id
sickUsed          int
casualUsed        int
privilegedUsed    int
compOffUsed       int
maternityUsed     int
paternityUsed     int
createdAt         timestamp
updatedAt         timestamp
```

```
ManageHoliday
id                 int      primary key
serviceProviderID  int
companyID          int      foreign key -> Company.id
branchesID         int      foreign key -> Branches.id
holidayName        varchar
monthPeriod        varchar
```

```
PublicHoliday
id                 int      primary key
serviceProviderID  int
companyID          int      foreign key -> Company.id
branchesID         int      foreign key -> Branches.id
manageHolidayID    int      foreign key -> ManageHoliday.id
financialYear      varchar
startDate          date
endDate            date
```

```
PrivilegedLeaveLedger
id                     int        primary key
serviceProviderID      int
companyID              int
branchesID             int
employeeID             int        foreign key -> ManageEmployee.id
leavePolicyID          int        foreign key -> leavePolicy.id
creditedLeaves         float
usedLeaves             float
balanceLeaves          float
creditDate             date
description            varchar
createdAt              timestamp
updatedAt              timestamp
```

```
PrivilegedLeaveLapse
id                    int        primary key
serviceProviderID     int
companyID             int
branchesID            int
employeeID            int        foreign key -> ManageEmployee.id
leavePolicyID         int        foreign key -> leavePolicy.id
leaveCount            float
lapseDate             date
reason                varchar
createdAt             timestamp
```

### Payroll

```
MonthlyPayGrade
id                   int      primary key
serviceProviderID    int
companyID            int      foreign key -> Company.id
branchesID           int      foreign key -> Branches.id
monthlyPayGradeName  varchar
salType              varchar
grossSalary          varchar
percentageOfBasic    varchar
basicSalary          int
miniOTTime           int
otRate               varchar
otStatus             boolean
payGradeType         varchar
```

```
MonthlyPayGradeAllowanceList
id                            int  primary key
monthlyPayGradeID             int  foreign key -> MonthlyPayGrade.id
salaryallowanceID             int  foreign key -> SalaryAllowance.id
```

```
MonthlyPayGradeDeductionList
id                            int  primary key
salaryDeductionID             int  foreign key -> SalaryDeduction.id
monthlyPayGradeID             int  foreign key -> MonthlyPayGrade.id
```

```
HourlyPayGrade
id                  int      primary key
serviceProviderID   int
companyID           int      foreign key -> Company.id
branchesID          int      foreign key -> Branches.id
hourlyPayGradeName  varchar
hourlyRate          varchar
```

```
SalaryAllowance
id                         int      primary key
serviceProviderID          int
companyID                  int      foreign key -> Company.id
branchesID                 int      foreign key -> Branches.id
salaryAllowanceName        varchar
displayName                varchar
salaryAllowanceType        varchar
salaryAllowanceValue       varchar
salaryAllowanceMonthLimit  varchar
allowanceType              varchar
basedOn                    varchar
```

```
SalaryDeduction
id                         int      primary key
serviceProviderID          int
companyID                  int      foreign key -> Company.id
branchesID                 int      foreign key -> Branches.id
salaryDeductionName        varchar
displayName                varchar
deductionTypeField         varchar
salaryDeductionType        varchar
salaryDeductionValue       varchar
salaryDeductionMonthLimit  varchar
basedOn                    varchar
```

```
SalaryCycle
id                 int      primary key
serviceProviderID  int
companyID          int      foreign key -> Company.id
branchesID         int      foreign key -> Branches.id
salaryCycleName    varchar
monthStartDay      varchar
```

```
GenerateSalary
id                 int        primary key
serviceProviderID  int
companyID          int        foreign key -> Company.id
branchesID         int        foreign key -> Branches.id
employeeID         int        foreign key -> ManageEmployee.id
monthPeriod        text
paymentMode        text
paymentType        text
paymentDate        text
paymentRemark      text
paymentProof       text
status             text
createdAt          timestamp
updatedAt          timestamp
```

```
BonusSetup
id                 int      primary key
serviceProviderID  int
companyID          int      foreign key -> Company.id
branchesID         int      foreign key -> Branches.id
bonusName          varchar
bonusType          varchar
bonusDescription   varchar
bonusBasedOn       varchar
bonusPercentage    varchar
bonusFixed         varchar
```

```
BonusAllocation
id               int  primary key
branchesID       int  foreign key -> Branches.id
departmentID     int  foreign key -> Departments.id
bonusSetupID     int  foreign key -> BonusSetup.id
financialYear    int
salaryPeriod     int
employeeID       int  foreign key -> ManageEmployee.id
```

```
GenarateBonus
id                 int  primary key
serviceProviderID  int
companyID          int  foreign key -> Company.id
branchesID         int  foreign key -> Branches.id
manageEmployeeID   int  foreign key -> leaveApplication.id
bonusSetupID       int  foreign key -> BonusSetup.id
financialYear      int
salaryPeriod       int
```

```
SalaryAdvance
id                    int        primary key
serviceProviderID     int
companyID             int        foreign key -> Company.id
branchesID            int        foreign key -> Branches.id
manageEmployeeID      int        foreign key -> ManageEmployee.id
previousAdvancesDue   text
advanceAmount         text
reason                text
requestType           text
approvedAmount        text
repaymentType         text
deductionStartPeriod  text
instalmentCount       int
instalmentAmount      text
disbursedAmount       text
disbursementDate      timestamp
paymentReference      text
recoveredAmount       text
outstandingBalance    text
status                text
createdAt             timestamp
updatedAt             timestamp
```

```
SalaryAdvanceRepayment
id                      int        primary key
salaryAdvanceID         int        foreign key -> SalaryAdvance.id
approvedAmount          text
startMonth              timestamp
amount                  text
periodLabel             text
status                  text
generateSalaryID        int        foreign key -> GenerateSalary.id
createdAt               timestamp
updatedAt               timestamp
```

```
PFCompliance
id                      int        primary key
companyID               int        unique, foreign key -> Company.id
epfThresholdCount       int
epfApplicable           boolean
voluntaryEnabled        boolean
wageCeiling             int
basicValidationPercent  float
compulsoryForAll        boolean
employeeRate            float
employerRate            float
epsRate                 float
edliRate                float
adminChargeRate         float
edliMax                 int
adminChargeMax          int
dueDate                 int
createdAt               timestamp
updatedAt               timestamp
```

```
ESICCompliance
id                   int        primary key
companyID            int        unique, foreign key -> Company.id
esicThresholdCount   int
esicApplicable       boolean
wageCeiling          int
disabledWageCeiling  int
employeeRate         float
employerRate         float
dueDate              int
createdAt            timestamp
updatedAt            timestamp
```

```
PTCompliance
id                        int        primary key
companyID                 int        unique with branchID, foreign key -> Company.id
branchID                  int        unique with companyID, foreign key -> Branches.id
ptApplicable              boolean
state                     text
maxPTPersonPerYear        int
monthlyDueDate            int
quarterlyDueDate          int
monthlyReturnThreshold    int
quarterlyReturnThreshold  int
createdAt                 timestamp
updatedAt                 timestamp
```

```
PTSlab
id                int        primary key
ptComplianceID    int        foreign key -> PTCompliance.id
slabName          text
monthlyGrossFrom  int
monthlyGrossTo    int
amount            int
applicableMonths  json
createdAt         timestamp
updatedAt         timestamp
```

### Reimbursement

```
Reimbursement
id                 int   primary key
serviceProviderID  int
companyID          int   foreign key -> Company.id
branchesID         int   foreign key -> Branches.id
departmentID       int   foreign key -> Departments.id
manageEmployeeID   int   foreign key -> ManageEmployee.id
taskProjectID      int
date               text
reimbursementType  text
amount             text
description        text
status             text
approvalType       text
salaryPeriod       text
voucherCode        text
voucherDate        text
paymentMode        text
paymentType        text
paymentDate        text
paymentRemark      text
paymentProof       text
```

```
ReimbursementItem
id                 int   primary key
reimbursementID    int   foreign key -> Reimbursement.id
reimbursementType  text
amount             text
description        text
status             text
approvalType       text
paidStatus         text
paymentRemark      text
```

### Contractors

```
Contractors
id                  int      primary key
serviceProviderID   int
companyID           int      foreign key -> Company.id
contractorName      varchar
address             varchar
country             varchar
state               varchar
city                varchar
pincode             varchar
timeZone            varchar
currency            varchar
pfNo                varchar
tanNo               varchar
esiNo               varchar
linNo               varchar
gstNo               varchar
gstCertUrl          varchar
shopRegNo           varchar
shopRegCertUrl      varchar
financialYearStart  varchar
contactNo           varchar
emailAdd            varchar
companyLogoUrl      varchar
SignatureUrl        varchar
contractorType      varchar
```

```
ContractorBranch
id                int        primary key
contractorID      int        unique with branchID, foreign key -> Contractors.id
branchID          int        unique with contractorID, foreign key -> Branches.id
isActive          boolean
createdAt         timestamp
updatedAt         timestamp
```

```
ContractorRateCard
id                  int      primary key
contractorID        int      foreign key -> Contractors.id
rateCardName        text
contractorName      varchar
branchName          varchar
departmentName      varchar
designation         varchar
workShiftName       varchar
payoutType          varchar
perMinuteRate       float
perHourRate         float
perDayRate          float
perMonthRate        float
dailyRateMinute     float
dailyRateHour       float
monthlyRateMinute   float
monthlyRateHours    float
otType              varchar
otPerMinuteRate     float
otPerHourRate       float
otRateMultiplier    float
commissionType      varchar
commissionBasedOn   varchar
commissionValue     float
```

```
ContractorPayout
id                int        primary key
contractorID      int        foreign key -> Contractors.id
branchID          int
departmentIDs     varchar
designationIDs    varchar
employeeIDs       varchar
workshiftIDs      varchar
rateCardID        int
createdAt         timestamp
updatedAt         timestamp
```

```
EmpContractor
id                int      primary key
manageEmployeeID  int      foreign key -> ManageEmployee.id
contractorID      int      foreign key -> Contractors.id
effectFrom        varchar
```

### Tasks

```
TaskCustomer
id                        int        primary key
serviceProviderID         int
companyID                 int        foreign key -> Company.id
branchesID                int        foreign key -> Branches.id
customerCode              varchar    unique
customerName              varchar
addressType               varchar
address                   text
city                      varchar
state                     varchar
pincode                   varchar
country                   varchar
gstNo                     varchar
erpAddressBookId          int        unique
relationshipManagerName   varchar
relationshipManagerEmail  varchar
createdByUserID           int
isDeleted                 boolean
createdAt                 timestamp
updatedAt                 timestamp
```

```
TaskCustomerContact
id                   int        primary key
customerID           int        foreign key -> TaskCustomer.id
contactPerson        varchar
contactNumber        varchar
designation          varchar
email                varchar
createdAt            timestamp
```

```
TaskCustomerSite
id                int        primary key
companyID         int        foreign key -> Company.id
customerID        int        foreign key -> TaskCustomer.id
siteCode          varchar    unique
erpSiteId         int        unique
branchName        varchar
address           text
city              varchar
state             varchar
pincode           varchar
country           varchar
gstNo             varchar
latitude          varchar
longitude         varchar
placeId           varchar
locationSource    varchar
locationVerified  boolean
isDeleted         boolean
createdAt         timestamp
updatedAt         timestamp
```

```
TaskCustomerSiteContact
id                       int        primary key
siteID                   int        foreign key -> TaskCustomerSite.id
contactPerson            varchar
contactNumber            varchar
designation              varchar
email                    varchar
createdAt                timestamp
```

```
TaskCustomerSiteNote
id                    int        primary key
siteID                int        foreign key -> TaskCustomerSite.id
title                 varchar
description           text
createdBy             varchar
createdAt             timestamp
updatedAt             timestamp
```

```
EnplEntityMapping
id                 int        primary key
companyID          int
entityType         varchar    unique with hrmsId
hrmsId             int        unique with entityType
enplId             int
enplCode           varchar
createdAt          timestamp
updatedAt          timestamp
```

```
TaskWorkscopeCategory
id                     int        primary key
companyID              int        unique with workscopeCategoryName, foreign key -> Company.id
workscopeCategoryName  varchar    unique with companyID
createdAt              timestamp
```

```
TaskProduct
id           int        primary key
companyID    int        unique with productName, foreign key -> Company.id
productName  varchar    unique with companyID
productCode  varchar
createdAt    timestamp
```

```
TaskProject
id                        int        primary key
serviceProviderID         int
companyID                 int        foreign key -> Company.id
taskCode                  varchar    unique
erpTaskId                 int        unique
departmentID              int        foreign key -> Departments.id
taskType                  varchar
customerID                int        foreign key -> TaskCustomer.id
siteID                    int        foreign key -> TaskCustomerSite.id
taskName                  varchar
description               text
attachment                varchar
scheduleDateTime          timestamp
priority                  varchar
dueDateTime               timestamp
expectedDurationMinutes   int
siteVisits                json
siteVisitSummary          json
siteLatitude              varchar
siteLongitude             varchar
daySignOutSelfieRequired  boolean
status                    varchar
createdByName             varchar
createdByUserID           int
createdByEmployeeID       int        foreign key -> ManageEmployee.id
isDeleted                 boolean
createdAt                 timestamp
updatedAt                 timestamp
```

```
TaskAssignment
id                int        primary key
taskID            int        unique with manageEmployeeID, foreign key -> TaskProject.id
manageEmployeeID  int        unique with taskID, foreign key -> ManageEmployee.id
assignedAt        timestamp
```

```
TaskEngineerAssignment
id                      int        primary key
taskID                  int        foreign key -> TaskProject.id
manageEmployeeID        int        foreign key -> ManageEmployee.id
engineerName            varchar
engineerEmail           varchar
engineerPhone           varchar
proposedDateTime        timestamp
priority                varchar
status                  varchar
notes                   text
assignedDate            timestamp
rescheduleReason        text
managerReason           text
enplAssignmentId        int
visitSequence           int
scheduledArrival        timestamp
visitDate               timestamp
allowedRadiusMeters     int
graceMinutes            int
visitDurationMinutes    int
visitLatitude           varchar
visitLongitude          varchar
complianceStatus        varchar
exceptionStatus         varchar
signOutForTheDay        boolean
createdAt               timestamp
updatedAt               timestamp
```

```
TaskRemark
id          int        primary key
taskID      int        foreign key -> TaskProject.id
userID      int
employeeID  int
authorName  varchar
createdBy   varchar
remark      text
status      varchar
createdAt   timestamp
```

```
TaskProjectContact
id                  int        primary key
taskID              int        foreign key -> TaskProject.id
contactName         varchar
contactNumber       varchar
contactEmail        varchar
designation         varchar
createdAt           timestamp
```

```
TaskWorkscopeDetail
id                   int        primary key
taskID               int        foreign key -> TaskProject.id
workscopeCategoryID  int        foreign key -> TaskWorkscopeCategory.id
workscopeDetails     text
extraNote            text
createdAt            timestamp
```

```
TaskSchedule
id                int        primary key
taskID            int        foreign key -> TaskProject.id
proposedDateTime  timestamp
priority          varchar
createdAt         timestamp
```

```
TaskImage
id              int        primary key
taskID          int        foreign key -> TaskProject.id
filename        varchar
filepath        varchar
fileUrl         varchar
mimeType        varchar
fileSize        int
uploadedBy      varchar
uploadedByName  varchar
uploadedAt      timestamp
erpFilepath     varchar
```

```
TaskNote
id              int        primary key
taskID          int        foreign key -> TaskProject.id
filename        varchar
title           varchar
description     text
filepath        varchar
fileUrl         varchar
mimeType        varchar
fileSize        int
note            text
uploadedBy      varchar
uploadedByName  varchar
uploadedAt      timestamp
erpFilepath     varchar
```

```
TaskInventory
id                  int        primary key
taskID              int        foreign key -> TaskProject.id
productTypeId       int        foreign key -> TaskProduct.id
makeModel           varchar
snMac               varchar
description         text
purchaseDate        timestamp
warrantyPeriod      varchar
warrantyStatus      varchar
thirdPartyPurchase  boolean
createdAt           timestamp
```

```
TaskPurchase
id            int        primary key
taskID        int        unique, foreign key -> TaskProject.id
purchaseType  varchar
customerName  varchar
address       text
createdAt     timestamp
```

```
TaskPurchaseProduct
id                   int        primary key
taskPurchaseID       int        foreign key -> TaskPurchase.id
make                 varchar
model                varchar
description          text
warranty             varchar
rate                 varchar
vendor               varchar
validity             varchar
availability         varchar
createdAt            timestamp
```

```
TaskPurchaseAttachment
id                      int        primary key
taskPurchaseID          int        foreign key -> TaskPurchase.id
filename                varchar
filepath                varchar
fileUrl                 varchar
mimeType                varchar
fileSize                int
uploadedAt              timestamp
erpFilepath             varchar
```

```
TaskChat
id                   int        primary key
taskID               int        foreign key -> TaskProject.id
userID               int
employeeID           int
recipientEmployeeID  int
senderName           varchar
message              text
attachmentUrl        varchar
createdAt            timestamp
```

```
TaskActivityLog
id               int        primary key
taskID           int        foreign key -> TaskProject.id
userID           int
employeeID       int
actorName        varchar
action           varchar
oldValue         varchar
newValue         varchar
remark           text
createdAt        timestamp
```

### Messaging and approvals

```
EmployeeMemo
id                 int        primary key
serviceProviderID  int
companyID          int
branchesID         int
employeeID         int        foreign key -> ManageEmployee.id
memoType           varchar
subject            varchar
description        text
issuedDate         date
issuedBy           varchar
senderEmployeeId   int
parentMemoId       int
attachmentPath     varchar
undoneAt           timestamp
createdAt          timestamp
updatedAt          timestamp
```

```
EmailTemplate
id             int        primary key
companyID      int        unique with eventType
eventType      varchar    unique with companyID
subject        varchar
bodyHtml       text
enabled        boolean
createdAt      timestamp
updatedAt      timestamp
```

```
CompanyPolicy
id             int                primary key
type           CompanyPolicyType
policyName     varchar
versionName    varchar
effectiveFrom  timestamp
bodyHtml       text
createdAt      timestamp
updatedAt      timestamp
```

```
ApprovalWorkflow    table approval_workflows
id                                            int                         primary key
serviceProviderID                             int
companyID                                     int                         unique with branchesID, companyModuleID, workflowName, foreign key -> Company.id
branchesID                                    int                         unique with companyID, companyModuleID, workflowName, foreign key -> Branches.id
companyModuleID                               int                         unique with companyID, branchesID, workflowName, foreign key -> CompanyModules.id
workflowName                                  text                        unique with companyID, branchesID, companyModuleID
workflowDescription                           text
effectiveFrom                                 timestamp
conditionMatchType                            WorkflowConditionMatchType
allowAnySameDesignation                       boolean
workflowStatus                                boolean
createdByUserID                               int
updatedByUserID                               int
createdAt                                     timestamp
updatedAt                                     timestamp
```

```
ApprovalWorkflowStep    table approval_workflow_steps
id                                                     int                   primary key
approvalWorkflowID                                     int                   unique with stepNo, foreign key -> ApprovalWorkflow.id
stepNo                                                 int                   unique with approvalWorkflowID
approverType                                           WorkflowApproverType
designationID                                          int                   foreign key -> Designations.id
approvalRequirement                                    ApprovalRequirement
stepName                                               text
isMandatory                                            boolean
canReject                                              boolean
canSendBack                                            boolean
approvalTimeout                                        int
createdAt                                              timestamp
updatedAt                                              timestamp
```

```
ApprovalWorkflowCondition    table approval_workflow_conditions
id                                                               int                         primary key
approvalWorkflowID                                               int                         unique with conditionNo, foreign key -> ApprovalWorkflow.id
conditionNo                                                      int                         unique with approvalWorkflowID
fieldKey                                                         WorkflowConditionField
operator                                                         WorkflowConditionOperator
valueType                                                        WorkflowConditionValueType
departmentID                                                     int                         foreign key -> Departments.id
designationID                                                    int                         foreign key -> Designations.id
branchesID                                                       int                         foreign key -> Branches.id
numberValue                                                      decimal
numberValueTo                                                    decimal
textValue                                                        text
booleanValue                                                     boolean
dateValue                                                        timestamp
dateValueTo                                                      timestamp
isActive                                                         boolean
createdAt                                                        timestamp
updatedAt                                                        timestamp
```

```
ApprovalWorkflowConditionEmployee    table approval_workflow_condition_employees
id                                                                                int        primary key
conditionID                                                                       int        unique with manageEmployeeID, foreign key -> ApprovalWorkflowCondition.id
manageEmployeeID                                                                  int        unique with conditionID, foreign key -> ManageEmployee.id
createdAt                                                                         timestamp
```

```
ApprovalRequest    table approval_requests
id                                          int                         primary key
serviceProviderID                           int
companyID                                   int
branchesID                                  int
approvalWorkflowID                          int                         foreign key -> ApprovalWorkflow.id
companyModuleID                             int                         foreign key -> CompanyModules.id
subjectType                                 text
subjectID                                   int
subjectEmployeeID                           int                         foreign key -> ManageEmployee.id
status                                      ApprovalRequestStatus
currentStepNo                               int
workflowNameSnapshot                        text
moduleKeySnapshot                           text
conditionMatchTypeSnapshot                  WorkflowConditionMatchType
allowAnySameDesignationSnapshot             boolean
submittedByUserID                           int
submittedAt                                 timestamp
completedAt                                 timestamp
rejectedAt                                  timestamp
cancelledAt                                 timestamp
finalRemark                                 text
createdAt                                   timestamp
updatedAt                                   timestamp
```

```
ApprovalRequestStep    table approval_request_steps
id                                                   int                  primary key
approvalRequestID                                    int                  unique with stepNo, foreign key -> ApprovalRequest.id
approvalWorkflowStepID                               int
stepNo                                               int                  unique with approvalRequestID
designationID                                        int
stepNameSnapshot                                     text
designationNameSnapshot                              text
approvalRequirementSnapshot                          ApprovalRequirement
isMandatorySnapshot                                  boolean
canRejectSnapshot                                    boolean
canSendBackSnapshot                                  boolean
approvalTimeoutSnapshot                              int
status                                               ApprovalStepStatus
activatedAt                                          timestamp
completedAt                                          timestamp
rejectedAt                                           timestamp
sentBackAt                                           timestamp
createdAt                                            timestamp
updatedAt                                            timestamp
```

```
ApprovalRequestApprover    table approval_request_approvers
id                                                           int                     primary key
approvalRequestID                                            int                     foreign key -> ApprovalRequest.id
approvalRequestStepID                                        int                     unique with approverEmployeeID, foreign key -> ApprovalRequestStep.id
approverEmployeeID                                           int                     unique with approvalRequestStepID, foreign key -> ManageEmployee.id
designationIDSnapshot                                        int
designationNameSnapshot                                      text
departmentIDSnapshot                                         int
branchesIDSnapshot                                           int
companyIDSnapshot                                            int
status                                                       ApprovalApproverStatus
activatedAt                                                  timestamp
actedAt                                                      timestamp
comment                                                      text
createdAt                                                    timestamp
updatedAt                                                    timestamp
```

```
ApprovalRequestAction    table approval_request_actions
id                                                       int                 primary key
approvalRequestID                                        int                 foreign key -> ApprovalRequest.id
approvalRequestStepID                                    int                 foreign key -> ApprovalRequestStep.id
approvalRequestApproverID                                int                 foreign key -> ApprovalRequestApprover.id
action                                                   ApprovalActionType
actedByEmployeeID                                        int                 foreign key -> ManageEmployee.id
actedByUserID                                            int
fromStatus                                               text
toStatus                                                 text
remark                                                   text
createdAt                                                timestamp
```

### Platform

```
AuditLog
id             int        primary key
userId         int
companyID      int
username       varchar
employeeName   varchar
userRole       varchar
action         varchar
module         varchar
entityId       varchar
entityName     varchar
oldData        text
newData        text
success        boolean
failureReason  varchar
ipAddress      varchar
browser        varchar
os             varchar
deviceType     varchar
location       varchar
userAgent      text
createdAt      timestamp
```

```
BackupRestoreLog
id                int        primary key
userId            int
username          varchar
backupDate        varchar
fileName          varchar
fileLabel         varchar
success           boolean
errorMessage      text
ipAddress         varchar
createdAt         timestamp
```

```
SubscriptionPlan
id                int        primary key
planName          text       unique
validityDays      int
planAmount        decimal
isActive          boolean
createdAt         timestamp
updatedAt         timestamp
```

```
SubscriptionPlanModule
id                      int        primary key
planID                  int        unique with moduleID, foreign key -> SubscriptionPlan.id
moduleID                int        unique with planID, foreign key -> Module.id
createdAt               timestamp
```

```
CompanySubscription
id                   int                 primary key
companyID            int                 foreign key -> Company.id
planID               int                 foreign key -> SubscriptionPlan.id
startDate            timestamp
endDate              timestamp
status               SubscriptionStatus
isActive             boolean
deactivatedAt        timestamp
deactivationWef      timestamp
deactivationReason   text
renewedFromID        int                 foreign key -> CompanySubscription.id
createdAt            timestamp
updatedAt            timestamp
```

```
AuthOtp
id            int             primary key
purpose       AuthOtpPurpose
identifier    varchar
codeHash      varchar
pendingToken  varchar         unique
payload       text
expiresAt     timestamp
consumedAt    timestamp
createdAt     timestamp
```

```
GoogleApiUsage    table google_api_usage
id                                        int        primary key
api                                       varchar
feature                                   varchar
httpStatus                                int
sessionToken                              varchar
createdAt                                 timestamp
```

```
DashboardPreference
id                   int                 primary key
companyId            int                 unique with actorType, actorId, dashboardType
actorType            DashboardActorType  unique with companyId, actorId, dashboardType
actorId              int                 unique with companyId, actorType, dashboardType
dashboardType        DashboardType       unique with companyId, actorType, actorId
layout               json
createdAt            timestamp
updatedAt            timestamp
```

### Enums

```
DeviceStatus
Active
Inactive
```

```
EmployeeLifecycleStatus
ACTIVE
INACTIVE
EXITED
```

```
LeaveType
SL
CL
PL
LOP
```

```
LeaveStatus
PENDING
APPROVED
REJECTED
```

```
ExitType
RESIGNATION
TERMINATION
RETRENCHMENT
RETIREMENT
DEATH
ABSCONDING
CONTRACT_END
```

```
ExitStatus
DRAFT
NOTICE_RUNNING
APPROVED
WITHDRAWN
CANCELLED
FINAL_SETTLED
```

```
UserRole
SUPERADMIN
SERVICE_PROVIDER
COMPANY_ADMIN
MULTI_COMPANY_ADMIN
CONTRACTOR_ADMIN
ADMIN
BRANCH_ADMIN
EMPLOYEE
```

```
OTStatus
PENDING
APPROVED
REJECTED
```

```
AttendanceStatus
LATE
HALFDAY
FULLDAY
ABSENT
LOP
WEEKOFF
```

```
RegularizeAs
PRESENT
HALF_DAY
LATE_MARK
SL
CL
PL
LOP
WEEKOFF
```

```
ApprovalRequirement
ANY
ALL
```

```
SubscriptionStatus
ACTIVE
INACTIVE
EXPIRED
CANCELLED
RENEWED
```

```
WorkflowConditionMatchType
ALL
ANY
```

```
WorkflowConditionField
BRANCH
DEPARTMENT
DESIGNATION
EMPLOYEE
TOTAL_AMOUNT
SALARY_AMOUNT
LEAVE_TYPE
LEAVE_DAYS
EXIT_TYPE
REGULARISATION_TYPE
REGULARISATION_DAYS
REQUEST_TEXT
```

```
WorkflowConditionOperator
EQUALS
NOT_EQUALS
GREATER_THAN
GREATER_THAN_OR_EQUAL
LESS_THAN
LESS_THAN_OR_EQUAL
IN
NOT_IN
CONTAINS
NOT_CONTAINS
BETWEEN
IS_EMPTY
IS_NOT_EMPTY
```

```
WorkflowConditionValueType
BRANCH
DEPARTMENT
DESIGNATION
EMPLOYEE_LIST
NUMBER
TEXT
BOOLEAN
DATE
```

```
WorkflowApproverType
DESIGNATION
REPORTING_MANAGER
```

```
ApprovalRequestStatus
PENDING
APPROVED
REJECTED
SENT_BACK
CANCELLED
```

```
ApprovalStepStatus
WAITING
PENDING
APPROVED
REJECTED
SENT_BACK
SKIPPED
CANCELLED
```

```
ApprovalApproverStatus
WAITING
PENDING
APPROVED
REJECTED
SENT_BACK
SKIPPED
CANCELLED
```

```
ApprovalActionType
SUBMITTED
APPROVED
REJECTED
SENT_BACK
STEP_ACTIVATED
STEP_COMPLETED
REQUEST_COMPLETED
CANCELLED
```

```
AuthOtpPurpose
FORGOT_PASSWORD
SUPERADMIN_LOGIN
```

```
CompanyPolicyType
TERMS_OF_USE
PRIVACY_POLICY
SLA
```

```
DashboardActorType
USER
EMPLOYEE
```

```
DashboardType
HOME
```

## What each table stores

One line per table. The column list in Database schema stays above this, with no notes between the columns.

### Company

- **Company.** The tenant company. Branches, employees, devices, and payroll rows point at this table.
- **Branches.** A company location, including the statutory numbers kept on that location. Joins Company.
- **CompanyFederalDomain.** A federal or statutory domain recorded for a company. Joins Company.
- **Module.** The catalog of product modules. moduleKey is unique.
- **CompanyModule.** Whether a company has a catalog module enabled. Joins Company and Module.
- **CompanyModules.** A module name and key used by approval workflows. The physical table is company_modules.
- **Departments.** A department, optionally under a parent department. Joins Company and Branches.
- **DepartmentBranch.** Links a department to a branch. Joins Departments and Branches.
- **Designations.** A job title, optionally under a department and a parent designation. Joins Company, Branches, and Departments.
- **ComplianceRule.** A compliance rule stored for a company. Joins Company.
- **User.** A login account and its role. Joins Company, Branches, and Contractors when those ids are set.
- **UserCompany.** Links one login to a company. Joins User and Company.
- **UserProfile.** Extra profile fields for a login. Joins User.
- **EmployeeModulePermission.** Which company modules an employee may view or change. Joins ManageEmployee and Company. The physical table is employee_module_permissions.
- **EmployeeCredentials.** The employee sign-in username and password. Joins ManageEmployee, Company, and Branches.

### Employees

- **ManageEmployee.** The employee. Joins Company, Branches, Departments, Designations, Contractors, WorkShift, AttendancePolicy, leavePolicy, the pay grades, and SalaryCycle.
- **EmployeeDocument.** A file stored on an employee. Joins ManageEmployee, Company, and Branches. The physical table is employee_documents.
- **EmployeeBankDetails.** The employee's bank account. Joins ManageEmployee. The physical table is employee_bank_details.
- **BankDetails.** A bank account held by a branch. Joins Branches and Company.
- **EmployeeFieldHistory.** One changed employee field, with the old value and the new value. Joins ManageEmployee.
- **EmployeeLink.** Links two employee rows. Both ids join ManageEmployee.
- **EmployeeTermination.** The offboarding record for an employee. Joins ManageEmployee.
- **EmpEduQualification.** An education line on an employee. Joins ManageEmployee.
- **EmpProfExprience.** A previous-employment line on an employee. Joins ManageEmployee.
- **EmpDesignation.** Designation history for an employee. Joins ManageEmployee and Designations.
- **EmpBranch.** Branch history for an employee. Joins ManageEmployee and Branches.
- **EmpDepartment.** Department history for an employee. Joins ManageEmployee and Departments.
- **EmpEmploymentType.** Employment-type history for an employee. Joins ManageEmployee.
- **EmpEmploymentStatus.** Employment-status history for an employee. Joins ManageEmployee.
- **EmpCurrentPosition.** The position recorded before a promotion or transfer. Joins ManageEmployee, Departments, Designations, and the pay grades.
- **PromotionRequest.** A promotion or transfer request. Joins ManageEmployee and the proposed department, designation, and pay grade.
- **EmpPromotion.** A promotion that was applied. Joins ManageEmployee and the new department, designation, shift, and policies.
- **EmployeeDelegation.** A manager hands approval rights to another employee. Both ids join ManageEmployee.

### Attendance

- **Devices.** An attendance device at a branch. Joins Company and Branches.
- **EmpDeviceMapping.** Maps an employee to the user id stored on a device. Joins ManageEmployee and Devices.
- **TokenDeviceMapping.** Maps an employee token to a device. Joins ManageEmployee and Devices.
- **AttendanceLogs.** A device punch waiting to be processed. Joins Devices.
- **EmpAttendanceLogs.** An attendance log row keyed by device and employee codes. This table declares no foreign key.
- **essl_raw_attlog.** The raw payload received from an eSSL device before processing.
- **process_att_logs.** The punch row that reports, regularisation, and salary read. Device and employee ids are columns, and this table declares no foreign key.
- **AttendanceLocation.** A mobile check-in location for an employee. Joins ManageEmployee. The physical table is attendance_locations.
- **EmpFieldSiteAttendance.** Attendance recorded at a field site. Joins ManageEmployee, Company, and Branches.
- **EmpAbsentDeclaration.** An employee marks a day absent. Joins ManageEmployee.
- **AttendancePolicy.** Late, half-day, and overtime rules. Joins Company and Branches.
- **EmpAttendancePolicy.** Which attendance policy applied to an employee. Joins ManageEmployee and AttendancePolicy.
- **WorkShift.** A shift definition. Joins Company and Branches.
- **WorkShiftDay.** One weekday on a shift. Joins WorkShift.
- **EmpWorkShift.** Which shift applied to an employee. Joins ManageEmployee and WorkShift.
- **Roster.** A roster period for a branch and department. Joins Company, Branches, Departments, and Designations.
- **RosterEmployee.** An employee placed on a roster. Joins Roster and ManageEmployee.
- **RosterDay.** One dated shift for an employee on a roster. Joins RosterEmployee and WorkShift.
- **EmpAttendanceRegularise.** A regularisation request for one employee and one date. Joins ManageEmployee, Company, Branches, and Departments.
- **EmployeeHolidayOverride.** Replaces a public holiday for one employee. Joins ManageEmployee and PublicHoliday.
- **EmployeeWeeklyOff.** The weekly off pattern for one employee. Joins ManageEmployee.
- **Overtime.** Overtime recorded for an employee against a shift. Joins ManageEmployee and WorkShift.
- **CalendarDay.** One calendar date. HolidayOnDay joins this table.
- **Holiday.** A named holiday that is not tied to one company.
- **HolidayOnDay.** Places a holiday on a calendar date. Joins Holiday and CalendarDay.

### Leave

- **leavePolicy.** Leave types and limits for a company. Joins Company and Branches.
- **leavePolicyHoliday.** A public holiday counted by a leave policy. Joins leavePolicy and PublicHoliday.
- **leaveApplication.** An employee's leave request. Joins ManageEmployee, Company, and Branches.
- **leaveApplicationRequest.** A related request hanging off a leave application. Joins leaveApplication.
- **EmpLeavePolicy.** Which leave policy applied to an employee. Joins ManageEmployee and leavePolicy.
- **EmpLeaveBalance.** Remaining leave for an employee. Joins ManageEmployee.
- **ManageHoliday.** A holiday list for a company. Joins Company and Branches.
- **PublicHoliday.** One holiday date on that list. Joins ManageHoliday, Company, and Branches.
- **PrivilegedLeaveLedger.** A privileged-leave credit or debit. Joins ManageEmployee and leavePolicy.
- **PrivilegedLeaveLapse.** Privileged leave that lapsed or was encashed. Joins ManageEmployee and leavePolicy.

### Payroll

- **MonthlyPayGrade.** A monthly salary grade. Joins Company and Branches.
- **MonthlyPayGradeAllowanceList.** An allowance attached to a monthly grade. Joins MonthlyPayGrade and SalaryAllowance.
- **MonthlyPayGradeDeductionList.** A deduction attached to a monthly grade. Joins MonthlyPayGrade and SalaryDeduction.
- **HourlyPayGrade.** An hourly rate grade. Joins Company and Branches.
- **SalaryAllowance.** An allowance a company can add to pay. Joins Company and Branches.
- **SalaryDeduction.** A deduction a company can take from pay. Joins Company and Branches.
- **SalaryCycle.** The salary period setup. Joins Company and Branches.
- **GenerateSalary.** One generated payslip for an employee and a period. Joins ManageEmployee, Company, and Branches.
- **BonusSetup.** How a bonus is calculated. Joins Company and Branches.
- **BonusAllocation.** Who receives a bonus setup for a period. Joins BonusSetup, ManageEmployee, Branches, and Departments.
- **GenarateBonus.** A calculated bonus amount. Joins BonusSetup, Company, and Branches. The manageEmployeeID column joins leaveApplication.
- **SalaryAdvance.** A salary advance or loan. Joins ManageEmployee, Company, and Branches.
- **SalaryAdvanceRepayment.** One recovery against an advance, optionally tied to a payslip. Joins SalaryAdvance and GenerateSalary.
- **PFCompliance.** Provident-fund rules for a company. Joins Company.
- **ESICCompliance.** ESI rules for a company. Joins Company.
- **PTCompliance.** Professional-tax rules for a company branch. Joins Company and Branches.
- **PTSlab.** An income slab under a professional-tax rule. Joins PTCompliance.

### Reimbursement

- **Reimbursement.** A claim. Joins ManageEmployee, Company, Branches, and Departments.
- **ReimbursementItem.** One expense line on a claim. Joins Reimbursement.

### Contractors

- **Contractors.** A contractor. Joins Company.
- **ContractorBranch.** Links a contractor to a branch. Joins Contractors and Branches.
- **ContractorRateCard.** Rates for a contractor. Joins Contractors.
- **ContractorPayout.** A payout for a contractor. Joins Contractors.
- **EmpContractor.** Which contractor an employee is attached to. Joins ManageEmployee and Contractors.

### Tasks

- **TaskCustomer.** A CRM customer. Joins Company and Branches.
- **TaskCustomerContact.** A contact on a customer. Joins TaskCustomer.
- **TaskCustomerSite.** A customer site. Joins TaskCustomer and Company.
- **TaskCustomerSiteContact.** A contact on a site. Joins TaskCustomerSite.
- **TaskCustomerSiteNote.** A note on a site. Joins TaskCustomerSite.
- **EnplEntityMapping.** Maps an HRMS id to an external ENPL id. companyID is a column, and this table declares no foreign key.
- **TaskWorkscopeCategory.** A workscope category. Joins Company.
- **TaskProduct.** A product used on tasks. Joins Company.
- **TaskProject.** A task or project. Joins Company, TaskCustomer, TaskCustomerSite, Departments, and the employee who created it.
- **TaskAssignment.** An employee assigned to a task. Joins TaskProject and ManageEmployee.
- **TaskEngineerAssignment.** An engineer assigned to a task. Joins TaskProject and ManageEmployee.
- **TaskRemark.** A remark on a task. Joins TaskProject.
- **TaskProjectContact.** A contact stored on a task. Joins TaskProject.
- **TaskWorkscopeDetail.** A workscope line on a task. Joins TaskProject and TaskWorkscopeCategory.
- **TaskSchedule.** A scheduled visit on a task. Joins TaskProject.
- **TaskImage.** An image on a task. Joins TaskProject.
- **TaskNote.** A note on a task. Joins TaskProject.
- **TaskInventory.** Inventory used on a task. Joins TaskProject and TaskProduct.
- **TaskPurchase.** A purchase on a task. Joins TaskProject.
- **TaskPurchaseProduct.** A product line on a task purchase. Joins TaskPurchase.
- **TaskPurchaseAttachment.** A file on a task purchase. Joins TaskPurchase.
- **TaskChat.** A chat message on a task. Joins TaskProject.
- **TaskActivityLog.** An activity line on a task. Joins TaskProject.

### Messaging and approvals

- **EmployeeMemo.** A direct message, group message, or notice. Joins ManageEmployee.
- **EmailTemplate.** The subject and body for a company email event. companyID is a column, and this table declares no foreign key.
- **CompanyPolicy.** A published policy document, with its version and the date it takes effect.
- **ApprovalWorkflow.** An approval chain for a company module. Joins Company, Branches, and CompanyModules. The physical table is approval_workflows.
- **ApprovalWorkflowStep.** One step in a workflow, optionally limited to a designation. Joins ApprovalWorkflow and Designations. The physical table is approval_workflow_steps.
- **ApprovalWorkflowCondition.** Which branch, department, designation, or amount a workflow applies to. Joins ApprovalWorkflow, Departments, Designations, and Branches. The physical table is approval_workflow_conditions.
- **ApprovalWorkflowConditionEmployee.** An employee named on a workflow condition. Joins ApprovalWorkflowCondition and ManageEmployee. The physical table is approval_workflow_condition_employees.
- **ApprovalRequest.** A request moving through a workflow. Joins ApprovalWorkflow, CompanyModules, and the subject employee. The physical table is approval_requests.
- **ApprovalRequestStep.** One step of a live request. Joins ApprovalRequest. The physical table is approval_request_steps.
- **ApprovalRequestApprover.** An approver on a request step. Joins ApprovalRequest, ApprovalRequestStep, and ManageEmployee. The physical table is approval_request_approvers.
- **ApprovalRequestAction.** An approve, reject, or other action on a request. Joins the request, the step, the approver, and the employee who acted. The physical table is approval_request_actions.

### Platform

- **AuditLog.** Who changed which record, including the module and the old and new values. companyID and userId are columns, and this table declares no foreign key.
- **BackupRestoreLog.** Whether a backup file was written or restored.
- **SubscriptionPlan.** A priced plan and how many days it lasts.
- **SubscriptionPlanModule.** Which catalog modules a plan includes. Joins SubscriptionPlan and Module.
- **CompanySubscription.** The plan a company is on. Joins Company and SubscriptionPlan, and renewedFromID joins an earlier CompanySubscription row.
- **AuthOtp.** A one-time sign-in or password code. The code is stored as a hash.
- **GoogleApiUsage.** One Google API call and its HTTP status. The physical table is google_api_usage.
- **DashboardPreference.** The saved card layout for a home or team dashboard. companyId is a column, and this table declares no foreign key.
