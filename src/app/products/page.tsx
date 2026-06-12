import { Boxes, ShieldAlert } from "lucide-react";
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
import { canManageProducts } from "@/lib/permissions/roles";
import { getProductCatalog } from "@/lib/products/catalog";
import type { Product } from "@/types/domain";

export default async function ProductsPage() {
  const session = await getRouteSession();

  if (!canAccessRoute(session, "products")) {
    return (
      <ProductsShell sessionLabel={session.displayName}>
        <AccessState
          title="Products are unavailable"
          description="Sign in with a staff account to view the catalog."
        />
      </ProductsShell>
    );
  }

  const catalog = await getProductCatalog(session.isDemoMode);
  const canEditCatalog = canManageProducts(session.role);
  const activeProducts = catalog.products.filter((product) => product.active);
  const lowStockProducts = activeProducts.filter(
    (product) => product.stock <= product.minStock,
  );
  const inventoryValueCents = activeProducts.reduce(
    (sum, product) => sum + Math.round(product.stock * product.salePriceCents),
    0,
  );

  return (
    <ProductsShell sessionLabel={session.displayName}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
                <Boxes className="size-5" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-normal">
                  Products
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeProducts.length} active catalog items
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {session.role}
            </Badge>
            {catalog.source === "demo" ? (
              <Badge variant="secondary">Demo data</Badge>
            ) : null}
            <Badge variant={canEditCatalog ? "default" : "secondary"}>
              {canEditCatalog ? "Catalog editor" : "Read only"}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Inventory value" value={formatMoney(inventoryValueCents)} />
          <Metric label="Low stock" value={String(lowStockProducts.length)} />
          <Metric label="Inactive" value={String(catalog.products.length - activeProducts.length)} />
        </div>

        {catalog.error ? (
          <AccessState
            title="Product data could not load"
            description="The catalog query failed for the current account."
          />
        ) : (
          <ProductTable products={catalog.products} canEditCatalog={canEditCatalog} />
        )}
      </div>
    </ProductsShell>
  );
}

function ProductsShell({
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

function ProductTable({
  canEditCatalog,
  products,
}: {
  canEditCatalog: boolean;
  products: Product[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Catalog</CardTitle>
        <CardDescription>
          Current catalog, prices, and stock levels.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>VAT</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Access</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-mono text-xs">
                    {product.sku}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.unit}</TableCell>
                  <TableCell>{product.vatRateBps / 100}%</TableCell>
                  <TableCell>{formatMoney(product.salePriceCents)}</TableCell>
                  <TableCell>
                    <StockBadge product={product} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.active ? "secondary" : "outline"}>
                      {product.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={canEditCatalog ? "default" : "outline"}>
                      {canEditCatalog ? "Edit" : "View"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
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

function StockBadge({ product }: { product: Product }) {
  const isLow = product.active && product.stock <= product.minStock;

  return (
    <Badge variant={isLow ? "destructive" : "secondary"}>
      {product.stock.toFixed(3)} {product.unit}
    </Badge>
  );
}

function AccessState({
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
