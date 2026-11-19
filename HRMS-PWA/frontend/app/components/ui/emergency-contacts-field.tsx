"use client";

import { Plus } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

export interface EmergencyContactEntry {
  name: string;
  relation: string;
  contactNo: string;
  priority: string;
}

export const EMPTY_EMERGENCY_CONTACT: EmergencyContactEntry = {
  name: "",
  relation: "",
  contactNo: "",
  priority: "Primary",
};

export function EmergencyContactsField({
  label = "Emergency Contact",
  values,
  onChange,
}: {
  label?: string;
  values: EmergencyContactEntry[];
  onChange: (values: EmergencyContactEntry[]) => void;
}) {
  const rows = values.length ? values : [{ ...EMPTY_EMERGENCY_CONTACT }];

  const updateAt = (index: number, field: keyof EmergencyContactEntry, value: string) => {
    const next = rows.map((row, i) => (i === index ? { ...row, [field]: value } : row));
    onChange(next);
  };

  const addRow = () => onChange([...rows, { ...EMPTY_EMERGENCY_CONTACT }]);

  const removeAt = (index: number) => {
    if (rows.length <= 1) {
      onChange([{ ...EMPTY_EMERGENCY_CONTACT }]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Emergency Contact {index + 1}</span>
              <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => removeAt(index)}>
                Remove
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Contact Name</Label>
            <Input
              value={row.name}
              onChange={(e) => updateAt(index, "name", e.target.value)}
              placeholder="Contact name"
            />
            </div>
            <div className="space-y-2">
              <Label>Relationship</Label>
            <Input
              value={row.relation}
              onChange={(e) => updateAt(index, "relation", e.target.value)}
              placeholder="Relationship"
            />
            </div>
            <div className="space-y-2">
              <Label>Contact Number</Label>
            <Input
              value={row.contactNo}
              onChange={(e) => updateAt(index, "contactNo", e.target.value)}
              placeholder="Contact number"
              inputMode="tel"
            />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={row.priority || "Primary"} onValueChange={(value) => updateAt(index, "priority", value)}>
                <SelectTrigger><SelectValue placeholder="Primary" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Primary">Primary</SelectItem>
                  <SelectItem value="Secondary">Secondary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="mr-1 h-4 w-4" /> Add Emergency Contact
        </Button>
      </div>
    </div>
  );
}
