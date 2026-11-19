import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, CalendarDays, ChevronRight } from "lucide-react";

export const homeCardClass =
  "flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#E5EAF1] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(23,36,58,0.04),0_8px_20px_rgba(23,36,58,0.04)]";

export function HomeCardLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-medium leading-none text-[#2563EB] hover:text-[#1d4ed8]">
      {children}
      <ChevronRight className="size-3.5" />
    </Link>
  );
}

export function HomeCardHeader({
  icon,
  title,
  aside,
  href,
  action = "View Details",
}: {
  icon: ReactNode;
  title: string;
  aside?: ReactNode;
  href?: string;
  action?: string;
}) {
  return (
    <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-5 shrink-0 place-items-center text-[#475569] [&_svg]:size-5">{icon}</span>
        <h2 className="truncate text-[17px] font-semibold leading-none !text-slate-900">{title}</h2>
        {aside}
      </div>
      {href ? <HomeCardLink href={href}>{action}</HomeCardLink> : null}
    </div>
  );
}

export function HomeCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`${homeCardClass} ${className}`}>{children}</section>;
}

export function ApprovalMiniCard({
  href,
  icon,
  value,
  label,
}: {
  href: string;
  icon: ReactNode;
  value: number;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex h-full min-h-[108px] flex-col items-center justify-center rounded-xl border border-[#E5EAF1] bg-[#F5F7FA] px-2 py-3 text-center"
    >
      <span className="text-[#475569] [&_svg]:size-6 [&_svg]:stroke-[1.75]">{icon}</span>
      <p className="mt-2 text-[26px] font-bold leading-none tabular-nums text-slate-900">{value}</p>
      <p className="mt-1.5 text-[13px] font-medium leading-tight text-slate-500">{label}</p>
    </Link>
  );
}

export function HomeNoticeRow({
  title,
  body,
  date,
}: {
  title: string;
  body?: string | null;
  date?: string | null;
}) {
  return (
    <li className="flex gap-3 rounded-xl border border-[#E5EAF1] border-l-[3px] border-l-[#2563EB] bg-[#F5F7FA] px-3 py-2.5">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
        <Bell className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold text-slate-900">{title}</p>
        {body ? <p className="line-clamp-2 text-[13px] text-slate-500">{body}</p> : null}
        {date ? (
          <p className="mt-1 flex items-center gap-1 text-[12px] text-slate-400">
            <CalendarDays className="size-3.5" />
            {date}
          </p>
        ) : null}
      </div>
    </li>
  );
}
