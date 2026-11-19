"use client";

import { cn } from "@/app/utils/cn";

export interface FormSectionTab {
  id: string;
  label: string;
}

interface FormSectionNavProps {
  active: string;
  onChange: (id: string) => void;
  sections: FormSectionTab[];
  ariaLabel?: string;
}

export function FormSectionNav({
  active,
  onChange,
  sections,
  ariaLabel = "Form sections",
  hideScrollbar = false,
}: FormSectionNavProps & { hideScrollbar?: boolean }) {
  return (
    <div className="mb-6 w-full rounded-lg border border-border bg-muted/40 p-1">
      <div
        className={cn(
          "flex w-full min-w-0 gap-1 overflow-x-auto",
          hideScrollbar ? "form-tabs-noscroll" : "app-scroll",
        )}
        role="tablist"
        aria-label={ariaLabel}
      >
        {sections.map((section) => {
          const isActive = active === section.id;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(section.id)}
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
