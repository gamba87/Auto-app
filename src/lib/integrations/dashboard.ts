import "server-only";

import { getFiscalConnector } from "@/lib/integrations/fiscal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { AppRole } from "@/types/domain";

type OutboxStatus = Database["public"]["Enums"]["outbox_status"];
type OutboxRow = Pick<
  Database["public"]["Tables"]["integration_outbox"]["Row"],
  | "aggregate_id"
  | "attempts"
  | "created_at"
  | "event_type"
  | "id"
  | "last_error"
  | "status"
>;

export type IntegrationDashboardEvent = {
  aggregateId: string;
  attempts: number;
  createdAt: string;
  eventType: string;
  id: string;
  lastError: string | null;
  status: OutboxStatus;
};

export type IntegrationDashboardResult = {
  error: string | null;
  eventTypeCounts: Array<{ count: number; eventType: string }>;
  fiscalStatus: {
    message: string | null;
    status: "READY" | "NOT_CONNECTED" | "ERROR";
  };
  recentEvents: IntegrationDashboardEvent[];
  source: "demo" | "supabase";
  statusCounts: Array<{ count: number; status: OutboxStatus }>;
};

const outboxStatuses = ["pending", "processing", "completed", "failed"] as const;
const fiscalEventTypes = ["sale.completed", "sale.voided"] as const;

function emptyCounts() {
  return {
    eventTypeCounts: fiscalEventTypes.map((eventType) => ({
      count: 0,
      eventType,
    })),
    statusCounts: outboxStatuses.map((status) => ({
      count: 0,
      status,
    })),
  };
}

function demoDashboard(): IntegrationDashboardResult {
  return {
    error: null,
    eventTypeCounts: [
      { count: 3, eventType: "sale.completed" },
      { count: 1, eventType: "sale.voided" },
    ],
    fiscalStatus: {
      message: "ASPA AM-1 integration has not been configured yet.",
      status: "NOT_CONNECTED",
    },
    recentEvents: [
      {
        aggregateId: "demo-sale-004",
        attempts: 1,
        createdAt: "2026-06-12T08:30:00.000Z",
        eventType: "sale.voided",
        id: "demo-outbox-004",
        lastError: "ASPA AM-1 integration has not been configured yet.",
        status: "failed",
      },
      {
        aggregateId: "demo-sale-003",
        attempts: 0,
        createdAt: "2026-06-12T08:20:00.000Z",
        eventType: "sale.completed",
        id: "demo-outbox-003",
        lastError: null,
        status: "pending",
      },
      {
        aggregateId: "demo-sale-002",
        attempts: 1,
        createdAt: "2026-06-12T08:10:00.000Z",
        eventType: "sale.completed",
        id: "demo-outbox-002",
        lastError: "ASPA AM-1 integration has not been configured yet.",
        status: "failed",
      },
      {
        aggregateId: "demo-sale-001",
        attempts: 0,
        createdAt: "2026-06-12T08:00:00.000Z",
        eventType: "sale.completed",
        id: "demo-outbox-001",
        lastError: null,
        status: "completed",
      },
    ],
    source: "demo",
    statusCounts: [
      { count: 1, status: "pending" },
      { count: 0, status: "processing" },
      { count: 1, status: "completed" },
      { count: 2, status: "failed" },
    ],
  };
}

function mapOutboxEvent(row: OutboxRow): IntegrationDashboardEvent {
  return {
    aggregateId: row.aggregate_id,
    attempts: row.attempts,
    createdAt: row.created_at,
    eventType: row.event_type,
    id: row.id,
    lastError: row.last_error,
    status: row.status,
  };
}

export async function getIntegrationDashboard(
  role: AppRole,
  useDemoData: boolean,
): Promise<IntegrationDashboardResult> {
  if (role !== "admin") {
    return {
      error: "Admin access is required.",
      fiscalStatus: {
        message: null,
        status: "ERROR",
      },
      recentEvents: [],
      source: useDemoData ? "demo" : "supabase",
      ...emptyCounts(),
    };
  }

  if (useDemoData) {
    return demoDashboard();
  }

  const supabase = await createSupabaseServerClient();
  const fiscalStatus = await getFiscalConnector().getStatus();
  const recentPromise = supabase
    .from("integration_outbox")
    .select(
      "id, event_type, aggregate_id, status, attempts, created_at, last_error",
    )
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<OutboxRow[]>();

  const statusCountPromises = outboxStatuses.map(async (status) => {
    const { count, error } = await supabase
      .from("integration_outbox")
      .select("id", { count: "exact", head: true })
      .eq("status", status);

    return { count: count ?? 0, error, status };
  });

  const eventTypeCountPromises = fiscalEventTypes.map(async (eventType) => {
    const { count, error } = await supabase
      .from("integration_outbox")
      .select("id", { count: "exact", head: true })
      .eq("event_type", eventType);

    return { count: count ?? 0, error, eventType };
  });

  const [recentResult, statusCounts, eventTypeCounts] = await Promise.all([
    recentPromise,
    Promise.all(statusCountPromises),
    Promise.all(eventTypeCountPromises),
  ]);
  const queryError =
    recentResult.error ??
    statusCounts.find((result) => result.error)?.error ??
    eventTypeCounts.find((result) => result.error)?.error;

  return {
    error: queryError?.message ?? null,
    eventTypeCounts: eventTypeCounts.map(({ count, eventType }) => ({
      count,
      eventType,
    })),
    fiscalStatus: {
      message: fiscalStatus.status === "ERROR" ? fiscalStatus.message : null,
      status: fiscalStatus.status,
    },
    recentEvents: (recentResult.data ?? []).map(mapOutboxEvent),
    source: "supabase",
    statusCounts: statusCounts.map(({ count, status }) => ({ count, status })),
  };
}

