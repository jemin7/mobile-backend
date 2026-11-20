-- Empty early-stage tables. Shifts, rosters, and punches stay on the live tables.
DROP TABLE IF EXISTS "FactualRosterDay";
DROP TABLE IF EXISTS "FactualRosterEmployee";
DROP TABLE IF EXISTS "FactualRoster";
DROP TABLE IF EXISTS "EmpFactualWorkShift";
DROP TABLE IF EXISTS "FactualWorkShiftDay";
DROP TABLE IF EXISTS "FactualWorkShift";
DROP TABLE IF EXISTS "EmpFactualAttendancePolicy";
DROP TABLE IF EXISTS "FactualAttendancePolicy";
DROP TABLE IF EXISTS "canteen_tr_logs";
DROP TABLE IF EXISTS "canteen_tv_logs";
DROP TABLE IF EXISTS "canteen_tv_not_logs";
DROP TABLE IF EXISTS "canteen_setup";
