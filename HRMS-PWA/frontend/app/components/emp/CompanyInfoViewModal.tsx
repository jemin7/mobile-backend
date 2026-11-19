"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FormDrawer } from "../ui/form-drawer";
import { EntityDetailHero, EntityDetailLayout } from "../app/entity-detail-layout";
import { DetailCard } from "../app/detail-card";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { getSidebarContext } from "../../utils/sidebarContext";
import { authHeaders } from "@/lib/auth";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

interface CompanyDetails {
  id: number;
  companyName?: string | null;
  legalEntityType?: string | null;
  companyType?: string | null;
  address?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  pincode?: string | null;
  contactNo?: string | null;
  emailAdd?: string | null;
  timeZone?: string | null;
  currency?: string | null;
  gstNo?: string | null;
  pfNo?: string | null;
  tanNo?: string | null;
  panNo?: string | null;
  esiNo?: string | null;
  linNo?: string | null;
  shopRegNo?: string | null;
  financialYearStart?: string | null;
  companyLogoUrl?: string | null;
  SignatureUrl?: string | null;
}

/**
 * Read-only view of the tenant's own company profile, in the same
 * hero + DetailCard layout used by the employee "View" modal.
 */
export function CompanyInfoViewModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const user = useCurrentUser();
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const resolveCompanyId = useCallback(async () => {
    const ctx = getSidebarContext();
    if (ctx?.companyID) return ctx.companyID;
    if (user?.companyID) return user.companyID;
    return null;
  }, [user]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const id = await resolveCompanyId();
        if (!id) {
          setCompany(null);
          return;
        }
        const res = await fetch(`${BACKEND}/company/${id}`, {
          headers: authHeaders(),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await res.text());
        setCompany(await res.json());
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Could not load company details");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, resolveCompanyId]);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Company Details"
      showHeaderCancel
      cancelLabel="Close"
    >
      {loading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
      ) : !company ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Could not load company details.</p>
      ) : (
        <EntityDetailLayout
          hero={
            <EntityDetailHero
              title={company.companyName || "—"}
              subtitle={
                <span>
                  {[company.city, company.state].filter(Boolean).join(", ") || "—"}
                </span>
              }
            />
          }
        >
          <DetailCard
            title="Overview"
            subtitle="Core company details"
            rows={[
              { label: "Company name", value: company.companyName },
              { label: "Registered address", value: company.address },
              { label: "Country", value: company.country },
              { label: "State", value: company.state },
              { label: "City", value: company.city },
              { label: "Pin", value: company.pincode },
            ]}
          />
        </EntityDetailLayout>
      )}
    </FormDrawer>
  );
}
