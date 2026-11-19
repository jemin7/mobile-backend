"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import { Settings } from "lucide-react";
import { PageHeader } from "@/app/components/app/page-header";
import { cn } from "@/app/utils/cn";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { canViewModule, isCompanyAdminLikeRole, isCompanyOwnerFlag } from "@/lib/companyAccess";

type SettingsTile = {
  id: string;
  label: string;
  href: string;
  icon: string;
  iconClassName: string;
  logsOnly?: boolean;
};

const GROUP_TILES: SettingsTile[] = [
  { id: "general", label: "General", href: "/settings/general", icon: "solar:settings-bold-duotone", iconClassName: "text-violet-700 dark:text-violet-300" },
  { id: "data", label: "Data Management", href: "/settings/data", icon: "solar:database-bold-duotone", iconClassName: "text-sky-700 dark:text-sky-300" },
  { id: "integration", label: "Third Party HRMS Integration", href: "/settings/integration", icon: "solar:link-circle-bold-duotone", iconClassName: "text-emerald-700 dark:text-emerald-300" },
];

const GENERAL_TILES: SettingsTile[] = [
  { id: "users", label: "User Management", href: "/system-settings/users", icon: "solar:users-group-rounded-bold-duotone", iconClassName: "text-indigo-700 dark:text-indigo-300" },
  { id: "smtp", label: "SMTP", href: "/system-settings/smtp", icon: "solar:letter-bold-duotone", iconClassName: "text-amber-700 dark:text-amber-300" },
  { id: "sms", label: "SMS Gateway", href: "/system-settings/sms", icon: "solar:chat-round-dots-bold-duotone", iconClassName: "text-teal-700 dark:text-teal-300" },
  { id: "logs", label: "System Logs", href: "/audit-logs", icon: "solar:document-text-bold-duotone", iconClassName: "text-fuchsia-700 dark:text-fuchsia-300", logsOnly: true },
];

const DATA_TILES: SettingsTile[] = [
  { id: "import", label: "Import Data", href: "/import-attendance", icon: "solar:import-bold-duotone", iconClassName: "text-cyan-700 dark:text-cyan-300" },
  { id: "retention", label: "Data Retention", href: "/system-settings/retention", icon: "solar:archive-bold-duotone", iconClassName: "text-rose-700 dark:text-rose-300" },
];

const INTEGRATION_TILES: SettingsTile[] = [
  { id: "hrms", label: "Third Party HRMS", href: "/system-settings/integration", icon: "solar:link-circle-bold-duotone", iconClassName: "text-emerald-700 dark:text-emerald-300" },
];

export function canOpenAllSettings(role?: string | null) {
  const normalized = String(role || "").toUpperCase();
  return normalized === "SUPERADMIN" || isCompanyOwnerFlag() || isCompanyAdminLikeRole(role);
}

export function canOpenSystemLogs(role?: string | null) {
  return canOpenAllSettings(role) || canViewModule("SYSTEM_LOGS");
}

export function SettingsTiles({
  title,
  description,
  tiles,
}: {
  title: string;
  description: string;
  tiles: "groups" | "general" | "data" | "integration";
}) {
  const user = useCurrentUser();
  if (!user) {
    return <div className="p-8 text-sm text-muted-foreground">Opening settings…</div>;
  }
  const full = canOpenAllSettings(user.role);
  const logs = canOpenSystemLogs(user?.role);
  const source =
    tiles === "groups" ? GROUP_TILES : tiles === "general" ? GENERAL_TILES : tiles === "data" ? DATA_TILES : INTEGRATION_TILES;
  const visible = full ? source : tiles === "groups" || tiles === "general" ? source.filter((tile) => tile.logsOnly || tile.id === "general") : [];

  if (!logs) {
    return <div className="p-8 text-sm text-muted-foreground">You do not have permission to open settings.</div>;
  }
  if (!full && visible.length === 0) {
    return <div className="p-8 text-sm text-muted-foreground">You do not have permission to open this section.</div>;
  }

  return (
    <div className="page-content-enter w-full max-w-none animate-fade-in space-y-6">
      <PageHeader icon={Settings} title={title} description={description} />
      <div className="grid w-full grid-cols-9 justify-items-center gap-x-4 gap-y-8 px-1 py-2">
        {visible.map((tile, index) => (
          <Link
            key={tile.id}
            href={tile.href}
            className="group relative flex w-full max-w-[104px] flex-col items-center gap-2 outline-none transition-transform duration-200 ease-out hover:-translate-y-0.5"
            style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
          >
            <div
              className={cn(
                "relative flex aspect-square w-full items-center justify-center rounded-2xl",
                "bg-[#F3F4F6] transition-colors duration-200 group-hover:bg-[#E8ECF1] dark:bg-[#2A2F38] dark:group-hover:bg-[#343A44]",
              )}
            >
              <Icon icon={tile.icon} className={cn("size-11", tile.iconClassName)} />
            </div>
            <p className="w-full text-center text-[12px] font-medium leading-snug text-foreground">{tile.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
