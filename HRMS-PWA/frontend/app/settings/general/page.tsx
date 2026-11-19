"use client";

import { SettingsTiles } from "../SettingsTiles";

export default function SettingsGeneralPage() {
  return (
    <SettingsTiles
      title="General"
      description="User management, mail, messages, and system logs."
      tiles="general"
    />
  );
}
