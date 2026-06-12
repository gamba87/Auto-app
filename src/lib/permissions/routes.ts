import type { AppRole } from "@/types/domain";

export type AppRouteKey = "products" | "stock" | "settingsIntegrations";

const routeRoles: Record<AppRouteKey, AppRole[]> = {
  products: ["cashier", "manager", "admin"],
  stock: ["cashier", "manager", "admin"],
  settingsIntegrations: ["admin"],
};

export function canRoleAccessRoute(role: AppRole, route: AppRouteKey) {
  return routeRoles[route].includes(role);
}

