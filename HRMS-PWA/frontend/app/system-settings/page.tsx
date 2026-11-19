"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { canOpenSystemLogs } from "../settings/SettingsTiles";

export default function SystemSettingsPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const allowed = !user || canOpenSystemLogs(user.role) || user.role === "SUPERADMIN";

  useEffect(() => {
    if (user && allowed) router.replace("/settings");
  }, [allowed, router, user]);

  if (user && !allowed) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Access restricted.</div>;
  }

  return <div className="p-8 text-center text-sm text-muted-foreground">Opening settings…</div>;
}
