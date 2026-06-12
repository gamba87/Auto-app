import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRoleFromAppMetadata } from "@/lib/permissions/roles";
import type { AppRole } from "@/types/domain";

export type AppRouteKey = "products" | "stock" | "settingsIntegrations";

export type RouteSession = {
  displayName: string;
  email: string | null;
  isAuthenticated: boolean;
  isDemoMode: boolean;
  role: AppRole;
  userId: string | null;
};

const routeRoles: Record<AppRouteKey, AppRole[]> = {
  products: ["cashier", "manager", "admin"],
  stock: ["cashier", "manager", "admin"],
  settingsIntegrations: ["admin"],
};

function hasSupabasePublicEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function canAccessRoute(session: RouteSession, route: AppRouteKey) {
  return (
    session.isDemoMode ||
    (session.isAuthenticated && routeRoles[route].includes(session.role))
  );
}

export async function getRouteSession(): Promise<RouteSession> {
  if (!hasSupabasePublicEnv()) {
    return {
      displayName: "Demo manager",
      email: null,
      isAuthenticated: true,
      isDemoMode: true,
      role: "manager",
      userId: null,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      displayName: "Not signed in",
      email: null,
      isAuthenticated: false,
      isDemoMode: false,
      role: "cashier",
      userId: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? getRoleFromAppMetadata(user.app_metadata);

  return {
    displayName: profile?.display_name || user.email || "Staff account",
    email: user.email ?? null,
    isAuthenticated: true,
    isDemoMode: false,
    role,
    userId: user.id,
  };
}

