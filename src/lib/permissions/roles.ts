import type { AppRole } from "@/types/domain";

const roleRank: Record<AppRole, number> = {
  cashier: 1,
  manager: 2,
  admin: 3,
};

export function canManageProducts(role: AppRole) {
  return roleRank[role] >= roleRank.manager;
}

export function canAdjustStock(role: AppRole) {
  return roleRank[role] >= roleRank.manager;
}

export function canVoidCompletedSale(role: AppRole) {
  return roleRank[role] >= roleRank.manager;
}

export function canCompleteSale(role: AppRole) {
  return roleRank[role] >= roleRank.cashier;
}

export function getRoleFromAppMetadata(
  appMetadata: Record<string, unknown> | null | undefined,
): AppRole {
  const role = appMetadata?.role;

  if (role === "admin" || role === "manager" || role === "cashier") {
    return role;
  }

  return "cashier";
}
