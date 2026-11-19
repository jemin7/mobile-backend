"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authHeaders } from "@/lib/auth";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { EmployeeRightsPanel } from "../components/emp/EmployeeRightsPanel";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { hasCompanyAccessFlag, isCompanyAdminLikeRole, isCompanyOwnerFlag } from "@/lib/companyAccess";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";
const PROVIDERS = ["GrytHR", "ZOHO", "HRONE", "EV24"];

type Section = "users" | "smtp" | "sms" | "retention" | "integration";

export function SystemSettingsSection({ section }: { section: Section }) {
  const user = useCurrentUser();
  const companyID = Number(user?.companyID || user?.activeCompanyID || 0);
  const allowed =
    isCompanyAdminLikeRole(user?.role) ||
    user?.role === "SUPERADMIN" ||
    (user?.role === "EMPLOYEE" && (isCompanyOwnerFlag() || hasCompanyAccessFlag()));
  const [employees, setEmployees] = useState<Array<{ id: number; name: string; employeeCode?: string }>>([]);
  const [employeeId, setEmployeeId] = useState(0);
  const [smtp, setSmtp] = useState({ host: "", port: "587", user: "", pass: "", from: "" });
  const [sms, setSms] = useState({ provider: "", senderId: "", apiKey: "" });
  const [retention, setRetention] = useState({ companyRecordsDays: "365", systemLogsDays: "90" });
  const [integrationProvider, setIntegrationProvider] = useState("");

  useEffect(() => {
    if (!allowed) return;
    const headers = authHeaders();
    if (section === "users") {
      fetch(`${BACKEND}/employee-permissions/employees`, { headers, cache: "no-store" })
        .then((res) => (res.ok ? res.json() : []))
        .then((rows) => {
          const list = (Array.isArray(rows) ? rows : []).map((row: any) => ({
            id: Number(row.id || row.employeeId),
            name: row.name || `${row.employeeFirstName || ""} ${row.employeeLastName || ""}`.trim(),
            employeeCode: row.employeeCode || row.employeeID,
          }));
          setEmployees(list.filter((row) => row.id));
          if (list[0]?.id) setEmployeeId(list[0].id);
        })
        .catch(() => setEmployees([]));
      return;
    }
    fetch(`${BACKEND}/system-settings?companyID=${companyID || ""}`, { headers, cache: "no-store" })
      .then((res) => (res.ok ? res.json() : {}))
      .then((payload) => {
        const data = payload as {
          smtp?: { host?: string; port?: number; user?: string; pass?: string; from?: string };
          sms?: { provider?: string; senderId?: string; apiKey?: string };
          retention?: { companyRecordsDays?: number; systemLogsDays?: number };
          integrationProvider?: string;
        };
        if (data.smtp) {
          setSmtp({
            host: data.smtp.host || "",
            port: String(data.smtp.port || 587),
            user: data.smtp.user || "",
            pass: data.smtp.pass || "",
            from: data.smtp.from || "",
          });
        }
        if (data.sms) setSms({ provider: data.sms.provider || "", senderId: data.sms.senderId || "", apiKey: data.sms.apiKey || "" });
        if (data.retention) {
          setRetention({
            companyRecordsDays: String(data.retention.companyRecordsDays || 365),
            systemLogsDays: String(data.retention.systemLogsDays || 90),
          });
        }
        if (data.integrationProvider) setIntegrationProvider(data.integrationProvider);
      })
      .catch(() => undefined);
  }, [allowed, section, companyID]);

  const save = async (body: Record<string, unknown>) => {
    const res = await fetch(`${BACKEND}/system-settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ companyID, ...body }),
    });
    if (!res.ok) {
      toast.error("Could not save settings");
      return;
    }
    toast.success("Saved");
  };

  if (user && !allowed) return <div className="p-8 text-sm text-muted-foreground">Access restricted.</div>;

  if (section === "users") {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-xl font-semibold">User Management</h1>
        <p className="text-sm text-muted-foreground">Choose an employee and the modules they may open.</p>
        <select className="h-10 w-full max-w-md rounded-md border bg-white px-3" value={employeeId || ""} onChange={(event) => setEmployeeId(Number(event.target.value))}>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>{employee.name}{employee.employeeCode ? ` (${employee.employeeCode})` : ""}</option>
          ))}
        </select>
        {employeeId ? <EmployeeRightsPanel employeeId={employeeId} /> : null}
      </div>
    );
  }

  if (section === "smtp") {
    return (
      <form className="max-w-lg space-y-3 p-4" onSubmit={(event) => { event.preventDefault(); void save({ smtp: { ...smtp, port: Number(smtp.port) || 587 } }); }}>
        <h1 className="text-xl font-semibold">SMTP</h1>
        {(["host", "port", "user", "pass", "from"] as const).map((field) => (
          <div key={field} className="space-y-1">
            <Label>{field}</Label>
            <Input type={field === "pass" ? "password" : "text"} value={smtp[field]} onChange={(event) => setSmtp((prev) => ({ ...prev, [field]: event.target.value }))} />
          </div>
        ))}
        <Button type="submit">Save</Button>
      </form>
    );
  }

  if (section === "sms") {
    return (
      <form className="max-w-lg space-y-3 p-4" onSubmit={(event) => { event.preventDefault(); void save({ sms }); }}>
        <h1 className="text-xl font-semibold">SMS Gateway</h1>
        <p className="text-sm text-muted-foreground">Saved for later. Messages are not sent from this screen.</p>
        {(["provider", "senderId", "apiKey"] as const).map((field) => (
          <div key={field} className="space-y-1">
            <Label>{field === "senderId" ? "Sender ID" : field === "apiKey" ? "API key" : "Provider"}</Label>
            <Input value={sms[field]} onChange={(event) => setSms((prev) => ({ ...prev, [field]: event.target.value }))} />
          </div>
        ))}
        <Button type="submit">Save</Button>
      </form>
    );
  }

  if (section === "retention") {
    return (
      <form className="max-w-lg space-y-3 p-4" onSubmit={(event) => { event.preventDefault(); void save({ retention: { companyRecordsDays: Number(retention.companyRecordsDays), systemLogsDays: Number(retention.systemLogsDays) } }); }}>
        <h1 className="text-xl font-semibold">Data Retention</h1>
        <div className="space-y-1">
          <Label>Company records, keep for days</Label>
          <Input value={retention.companyRecordsDays} onChange={(event) => setRetention((prev) => ({ ...prev, companyRecordsDays: event.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label>System logs, keep for days</Label>
          <Input value={retention.systemLogsDays} onChange={(event) => setRetention((prev) => ({ ...prev, systemLogsDays: event.target.value }))} />
        </div>
        <Button type="submit">Save</Button>
      </form>
    );
  }

  return (
    <form className="max-w-lg space-y-3 p-4" onSubmit={(event) => { event.preventDefault(); void save({ integrationProvider }); }}>
      <h1 className="text-xl font-semibold">Third Party HRMS Integration</h1>
      <select className="h-10 w-full rounded-md border bg-white px-3" value={integrationProvider} onChange={(event) => setIntegrationProvider(event.target.value)}>
        <option value="">Select a provider</option>
        {PROVIDERS.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
      </select>
      <Button type="submit">Save</Button>
    </form>
  );
}
