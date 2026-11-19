import { redirect } from "next/navigation";

export default function EmpAttendancePage() {
  redirect("/empProfile?tab=attendance");
}
