"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import { useCurrentUser } from "../../../hooks/useCurrentUser";
import { getSidebarContext } from "../../../utils/sidebarContext";
import { authHeaders } from "@/lib/auth";
import { isCompanyOwnerFlag, readCompanyAccess } from "@/lib/companyAccess";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type CompanyProfileForm = {
  companyName: string;
  address: string;
  country: string;
  state: string;
  city: string;
  pincode: string;
  gstNo: string;
  panNo: string;
  pfNo: string;
  tanNo: string;
  esiNo: string;
  linNo: string;
};

const EMPTY_FORM: CompanyProfileForm = {
  companyName: "",
  address: "",
  country: "",
  state: "",
  city: "",
  pincode: "",
  gstNo: "",
  panNo: "",
  pfNo: "",
  tanNo: "",
  esiNo: "",
  linNo: "",
};

function canEditCompanyProfile(): boolean {
  if (typeof window === "undefined") return false;
  if (isCompanyOwnerFlag()) return true;
  if (readCompanyAccess()?.ownerTitle) return true;
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return !!(
      user?.isCompanyOwner ||
      user?.employee?.isCompanyOwner ||
      user?.ownerTitle ||
      user?.employee?.ownerTitle
    );
  } catch {
    return false;
  }
}

function formFromCompany(company: Partial<CompanyProfileForm> | null): CompanyProfileForm {
  return {
    companyName: company?.companyName ?? "",
    address: company?.address ?? "",
    country: company?.country ?? "",
    state: company?.state ?? "",
    city: company?.city ?? "",
    pincode: company?.pincode ?? "",
    gstNo: company?.gstNo ?? "",
    panNo: company?.panNo ?? "",
    pfNo: company?.pfNo ?? "",
    tanNo: company?.tanNo ?? "",
    esiNo: company?.esiNo ?? "",
    linNo: company?.linNo ?? "",
  };
}

export function EmpCompanyProfilePanel() {
  const user = useCurrentUser();
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [form, setForm] = useState<CompanyProfileForm>(EMPTY_FORM);
  const [savedForm, setSavedForm] = useState<CompanyProfileForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  const resolveCompanyId = useCallback(() => {
    const ctx = getSidebarContext();
    if (ctx?.companyID) return Number(ctx.companyID);
    if (user?.companyID) return Number(user.companyID);
    return null;
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const id = resolveCompanyId();
        if (!id) {
          if (!cancelled) {
            setCompanyId(null);
            setForm(EMPTY_FORM);
          }
          return;
        }
        const res = await fetch(`${BACKEND}/company/${id}`, {
          headers: authHeaders(),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (!cancelled) {
          const next = formFromCompany(data);
          setCompanyId(id);
          setForm(next);
          setSavedForm(next);
          setEditing(false);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Could not load company profile");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolveCompanyId]);

  useEffect(() => {
    setCanEdit(canEditCompanyProfile());
  }, []);

  const update = (key: keyof CompanyProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    if (!companyId) {
      toast.error("Company not found");
      return;
    }
    if (!form.companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        (Object.keys(form) as Array<keyof CompanyProfileForm>)
          .filter((key) => key !== "companyName")
          .map((key) => [key, form[key].trim()]),
      );
      const res = await fetch(`${BACKEND}/company/${companyId}/profile`, {
        method: "PATCH",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        let message = errText;
        try {
          message = JSON.parse(errText)?.message || errText;
        } catch {
          /* keep text */
        }
        throw new Error(message || "Could not save company profile");
      }
      const data = await res.json().catch(() => null);
      const next = data ? formFromCompany(data) : form;
      setForm(next);
      setSavedForm(next);
      setEditing(false);
      toast.success("Company profile updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save company profile");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setForm(savedForm);
    setEditing(false);
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading company profile…</p>;
  }

  const fieldClass = editing ? "" : "bg-muted/40";

  const actions = canEdit ? (
    editing ? (
      <div className="flex shrink-0 gap-2">
        <Button type="button" variant="outline" onClick={cancelEdit} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" onClick={() => void save()} disabled={saving || !companyId}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    ) : (
      <Button type="button" variant="outline" className="shrink-0" onClick={() => setEditing(true)}>
        Edit
      </Button>
    )
  ) : null;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div>
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-base font-semibold">General information</h3>
            {actions}
          </div>
          <p className="text-sm text-muted-foreground">Company name, address, and location.</p>
        </div>
        <div className="space-y-2">
          <Label>Company name</Label>
          <Input value={form.companyName} readOnly className="bg-muted/40" />
        </div>
        <div className="space-y-2">
          <Label>Registered address</Label>
          <Textarea
            value={form.address}
            readOnly={!editing}
            className={fieldClass}
            onChange={(e) => update("address", e.target.value)}
            rows={3}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Country</Label>
            <Input value={form.country} readOnly={!editing} className={fieldClass} onChange={(e) => update("country", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <Input value={form.state} readOnly={!editing} className={fieldClass} onChange={(e) => update("state", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input value={form.city} readOnly={!editing} className={fieldClass} onChange={(e) => update("city", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Pin</Label>
            <Input value={form.pincode} readOnly={!editing} className={fieldClass} onChange={(e) => update("pincode", e.target.value)} />
          </div>
        </div>
      </section>

      {false && (
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-semibold">Compliance and tax</h3>
          <p className="text-sm text-muted-foreground">GST, PAN, and statutory numbers.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>GST No</Label>
            <Input value={form.gstNo} readOnly={!editing} className={fieldClass} onChange={(e) => update("gstNo", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>PAN No</Label>
            <Input value={form.panNo} readOnly={!editing} className={fieldClass} onChange={(e) => update("panNo", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>PF No</Label>
            <Input value={form.pfNo} readOnly={!editing} className={fieldClass} onChange={(e) => update("pfNo", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>TAN No</Label>
            <Input value={form.tanNo} readOnly={!editing} className={fieldClass} onChange={(e) => update("tanNo", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>ESI No</Label>
            <Input value={form.esiNo} readOnly={!editing} className={fieldClass} onChange={(e) => update("esiNo", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>LIN No</Label>
            <Input value={form.linNo} readOnly={!editing} className={fieldClass} onChange={(e) => update("linNo", e.target.value)} />
          </div>
        </div>
      </section>
      )}
    </div>
  );
}
