"use client";

import { SettingsTiles } from "../SettingsTiles";

export default function SettingsDataPage() {
  return (
    <SettingsTiles
      title="Data Management"
      description="Import company data and set how long it is kept."
      tiles="data"
    />
  );
}
