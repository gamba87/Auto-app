import { Archive, ShieldAlert } from "lucide-react";
import Link from "next/link";
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
import { formatMoney } from "@/lib/money";
import {
  getStockDashboard,
  type StockDashboardMovement,
} from "@/lib/stock/dashboard";
import type { Product } from "@/types/domain";

export default async function StockPage() {
  const session = await getRouteSession();

  if (!canAccessRoute(session, "stock")) {
    return (
      <StockShell sessionLabel={session.displayName}>
        <StateCard
          title="Stock is unavailable"
          description="Sign in with a staff account to view stock levels."
        />
      </StockShell>
    );
  }

  const dashboard = await getStockDashboard(session.role, session.isDemoMode);
  const activeProducts = dashboard.products.filter((product) => product.active);
  const lowStockProducts = activeProducts.filter(
    (product) => product.stock <= product.minStock,
  );
  const totalQuantity = activeProducts.reduce(
    (sum, product) => sum + product.stock,
    0,
  );
  const inventoryValueCents = activeProducts.reduce(
    (sum, product) => sum + Math.round(product.stock * product.salePriceCents),
    0,
  );

  return (
    <StockShell sessionLabel={session.displayName}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
              <Archive className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">Stock</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Current stock levels and movement visibility
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {session.role}
            </Badge>
            {dashboard.source === "demo" ? (
              <Badge variant="secondary">Demo data</Badge>
            ) : null}
            <Badge variant={dashboard.canViewMovements ? "default" : "secondary"}>
              {dashboard.canViewMovements ? "Movement history" : "Stock levels"}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Inventory value" value={formatMoney(inventoryValueCents)} />
          <Metric label="Total quantity" value={totalQuantity.toFixed(3)} />
          <Metric label="Low stock" value={String(lowStockProducts.length)} />
        </div>

        {dashboard.error ? (
          <StateCard
            title="Stock data could not load"
            description={dashboard.error}
          />
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <StockLevelsTable products={dashboard.products} />
          <MovementHistory
            canViewMovements={dashboard.canViewMovements}
            movements={dashboard.movements}
          />
        </div>
      </div>
    </StockShell>
  );
}

function StockShell({
  children,
  sessionLabel,
}: {
  children: React.ReactNode;
  sessionLabel: string;
}) {
  return (
    <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="text-sm font-medium text-muted-foreground">
            ASPA POS
          </Link>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldAlert className="size-4" aria-hidden="true" />
            <span>{sessionLabel}</span>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}

function StockLevelsTable({ products }: { products: Product[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock levels</CardTitle>
        <CardDescription>Current sellable product quantities.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Minimum</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const isLow = product.active && product.stock <= product.minStock;

                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-xs">
                      {product.sku}
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      {product.stock.toFixed(3)} {product.unit}
                    </TableCell>
                    <TableCell>
                      {product.minStock.toFixed(3)} {product.unit}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isLow ? "destructive" : "secondary"}>
                        {isLow ? "Low" : "OK"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatMoney(
                        Math.round(product.stock * product.salePriceCents),
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function MovementHistory({
  canViewMovements,
  movements,
}: {
  canViewMovements: boolean;
  movements: StockDashboardMovement[];
}) {
  if (!canViewMovements) {
    return (
      <StateCard
        title="Movement history"
        description="Managers and admins can view stock movement history."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Movement history</CardTitle>
        <CardDescription>Latest stock ledger entries.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Sale</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No movement history found.
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell className="font-mono text-xs">
                      {new Date(movement.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{movement.productName}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {movement.productSku}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{movement.reason}</Badge>
                    </TableCell>
                    <TableCell>{movement.quantityDelta}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {movement.saleId ?? "-"}
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate">
                      {movement.note ?? "-"}
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

function StateCard({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
