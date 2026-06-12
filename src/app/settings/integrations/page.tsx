import { Cable, CircleAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canAccessRoute, getRouteSession } from "@/lib/auth/route-access";
import {
  getIntegrationDashboard,
  type IntegrationDashboardEvent,
} from "@/lib/integrations/dashboard";

export default async function IntegrationsPage() {
  const session = await getRouteSession({
    demoDisplayName: "Demo admin",
    demoRole: "admin",
  });

  if (!canAccessRoute(session, "settingsIntegrations")) {
    redirect("/");
  }

  const dashboard = await getIntegrationDashboard(
    session.role,
    session.isDemoMode,
  );

  return (
    <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="text-sm font-medium text-muted-foreground">
            ASPA POS
          </Link>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4" aria-hidden="true" />
            <span>{session.displayName}</span>
          </div>
        </div>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
              <Cable className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">
                Integrations
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Fiscal connector and outbox status
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">admin</Badge>
            {dashboard.source === "demo" ? (
              <Badge variant="secondary">Demo data</Badge>
            ) : null}
            <Badge variant="secondary">Read only</Badge>
          </div>
        </div>

        {dashboard.error ? (
          <Card>
            <CardHeader>
              <CardTitle>Integration data could not load</CardTitle>
              <CardDescription>{dashboard.error}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <ConnectorCard
            message={dashboard.fiscalStatus.message}
            status={dashboard.fiscalStatus.status}
          />
          <div className="grid gap-3 sm:grid-cols-4">
            {dashboard.statusCounts.map((item) => (
              <Metric
                key={item.status}
                label={item.status}
                value={String(item.count)}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <EventTypeCard eventTypeCounts={dashboard.eventTypeCounts} />
          <RecentEventsTable events={dashboard.recentEvents} />
        </div>
      </div>
    </main>
  );
}

function ConnectorCard({
  message,
  status,
}: {
  message: string | null;
  status: "READY" | "NOT_CONNECTED" | "ERROR";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fiscal connector</CardTitle>
        <CardDescription>ASPA AM-1</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <Badge variant={status === "READY" ? "default" : "outline"}>
            {status}
          </Badge>
          {status !== "READY" ? (
            <CircleAlert className="size-5 text-muted-foreground" />
          ) : null}
        </div>
        {message ? (
          <p className="mt-4 text-sm leading-5 text-muted-foreground">
            {message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EventTypeCard({
  eventTypeCounts,
}: {
  eventTypeCounts: Array<{ count: number; eventType: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Event types</CardTitle>
        <CardDescription>Fiscal outbox events</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {eventTypeCounts.map((item) => (
            <div
              key={item.eventType}
              className="flex items-center justify-between border-b py-2 last:border-b-0"
            >
              <span className="font-mono text-xs">{item.eventType}</span>
              <Badge variant="secondary">{item.count}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentEventsTable({
  events,
}: {
  events: IntegrationDashboardEvent[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent events</CardTitle>
        <CardDescription>Latest fiscal outbox records</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Sale</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Last error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No outbox events found.
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-mono text-xs">
                      {new Date(event.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {event.eventType}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {event.aggregateId}
                    </TableCell>
                    <TableCell>
                      <Badge variant={event.status === "failed" ? "destructive" : "secondary"}>
                        {event.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{event.attempts}</TableCell>
                    <TableCell className="max-w-[320px] truncate">
                      {event.lastError ?? "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

