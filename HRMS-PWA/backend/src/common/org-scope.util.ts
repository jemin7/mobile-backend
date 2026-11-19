import { PrismaService } from '../prisma/prisma.service';

/**
 * A blank parent branch stays blank. A chosen branch is kept only when it
 * belongs to the company.
 */
export async function snapBranchesIDToCompany(
  prisma: PrismaService,
  companyID: number | null | undefined,
  branchesID: number | null | undefined,
): Promise<number | null> {
  const requested = Number(branchesID);
  if (!Number.isFinite(requested) || requested <= 0) return null;

  const company = Number(companyID);
  if (!Number.isFinite(company) || company <= 0) return requested;

  const branch = await prisma.branches.findUnique({
    where: { id: requested },
    select: { id: true, companyID: true },
  });
  if (branch && Number(branch.companyID) === company) return branch.id;
  return null;
}
