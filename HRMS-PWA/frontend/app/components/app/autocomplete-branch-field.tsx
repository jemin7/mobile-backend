"use client";

import { type ReactNode } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type AutocompleteBranchFieldProps = {
  label?: string;
  placeholder?: string;
  value: string;
  branchId?: number | null;
  companyID?: number | null;
  required?: boolean;
  disabled?: boolean;
  onInputChange: (display: string) => void;
  onBranchSelect: (branch: { id: number; branchName: string; item?: any }) => void;
  onFetch: (query: string) => void;
  options: Array<{ id: number; branchName?: string | null }>;
  optionsLoading?: boolean;
  hint?: ReactNode;
};

/**
 * Optional parent-branch picker. A company with one branch still shows that
 * name in the list, and the field stays editable so it can be cleared.
 */
export function AutocompleteBranchField({
  label = "Parent branch",
  placeholder = "Search parent branch…",
  value,
  required = false,
  disabled = false,
  onInputChange,
  onBranchSelect,
  onFetch,
  options,
  optionsLoading = false,
  hint,
}: AutocompleteBranchFieldProps) {
  const seen = new Set<number>();
  const seenNames = new Set<string>();
  const uniqueOptions = options.filter((br) => {
    const id = Number(br.id);
    if (!Number.isFinite(id) || seen.has(id)) return false;
    const nameKey = String(br.branchName || "").trim().toLowerCase();
    if (nameKey && seenNames.has(nameKey)) return false;
    seen.add(id);
    if (nameKey) seenNames.add(nameKey);
    return true;
  });

  return (
    <div className="space-y-2 relative">
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(e) => {
          const val = e.target.value;
          onInputChange(val);
          onFetch(val);
        }}
        onFocus={() => onFetch(value || "")}
        placeholder={placeholder}
        autoComplete="off"
        required={required}
        disabled={disabled}
      />
      {uniqueOptions.length > 0 && (
        <div className="absolute z-10 bg-white dark:bg-card border rounded w-full shadow max-h-48 overflow-y-auto">
          {optionsLoading && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Loading…</div>
          )}
          {uniqueOptions.map((br) => (
            <div
              key={br.id}
              className="px-3 py-2 hover:bg-muted cursor-pointer"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onBranchSelect({
                  id: br.id,
                  branchName: br.branchName ?? "",
                  item: br,
                });
              }}
            >
              {br.branchName}
            </div>
          ))}
        </div>
      )}
      {hint}
    </div>
  );
}
