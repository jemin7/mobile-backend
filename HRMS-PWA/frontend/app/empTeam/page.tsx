import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { EmpDesktopWorkspaceGate } from "../components/emp/EmpDesktopWorkspaceGate";
import { EmpTeamOverview } from "../components/emp/EmpTeamOverview";
import { EmpTeamMobile } from "../components/emp/EmpTeamMobile";

export default function EmpTeamPage() {
  return (
    <EmpMobileLayout>
      <EmpDesktopWorkspaceGate workspace={<EmpTeamOverview />} mobile={<EmpTeamMobile />} />
    </EmpMobileLayout>
  );
}
