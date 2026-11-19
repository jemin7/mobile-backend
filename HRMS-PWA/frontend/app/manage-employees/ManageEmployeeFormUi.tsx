"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/app/utils/cn";
import type { FormSectionTab } from "../components/app/form-section-nav";

export type EmpFormSectionId =
  | "basic"
  | "employment"
  | "contact"
  | "statutory"
  | "bank"
  | "attendanceLeave"
  | "documents"
  | "privacy"
  | "additional"
  | "attendance"
  | "roles&permissions";

export const EMPLOYEE_FORM_SECTIONS: FormSectionTab[] = [
  { id: "basic", label: "Basic Information" },
  { id: "employment", label: "Employment" },
  { id: "contact", label: "Contact & Address" },
  { id: "statutory", label: "Statutory & KYC" },
  { id: "bank", label: "Bank & Payroll" },
  { id: "attendanceLeave", label: "Attendance & Leave" },
  { id: "documents", label: "Documents" },
  { id: "privacy", label: "Privacy & Review" },
  { id: "attendance", label: "Attendance & Selfcare Setup" },
];

export function EmployeeFormSectionNav({
  active,
  onChange,
  sections = EMPLOYEE_FORM_SECTIONS,
}: {
  active: EmpFormSectionId;
  onChange: (id: EmpFormSectionId) => void;
  sections?: FormSectionTab[];
}) {
  const visible = sections.filter((section) => section.id !== "additional");

  return (
    <div className="mb-6 w-full rounded-lg border border-border bg-muted/40 p-1">
      <div
        className="form-tabs-noscroll flex w-full min-w-0 gap-1 overflow-x-auto"
        role="tablist"
        aria-label="Employee form sections"
      >
        {visible.map((section) => {
          const isActive = active === section.id;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(section.id as EmpFormSectionId)}
              className={cn(
                "shrink-0 rounded-md px-3 py-2.5 text-xs font-medium transition-all sm:px-4 sm:text-sm",
                isActive
                  ? "bg-background text-primary shadow-sm ring-1 ring-primary/20"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
            >
              {section.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CollapsibleFormGroup({
  title,
  expanded,
  onToggle,
  children,
}: {
  title?: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/50"
        aria-expanded={expanded}
      >
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-sm"
          aria-hidden
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {expanded ? <div className="border-t border-border px-3 py-3">{children}</div> : null}
    </div>
  );
}
