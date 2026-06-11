"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Archive,
  Boxes,
  ChartNoAxesCombined,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Plus,
  ReceiptText,
  RotateCcw,
  ShieldAlert,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculateVatFromGross, formatMoney } from "@/lib/money";
import {
  canAdjustStock,
  canManageProducts,
  canVoidCompletedSale,
} from "@/lib/permissions/roles";
import {
  productFormSchema,
  type ProductFormValues,
} from "@/lib/validation/product";
import {
  stockAdjustmentSchema,
  type StockAdjustmentValues,
} from "@/lib/validation/stock";
import type {
  AppRole,
  CompletedSale,
  Customer,
  DraftSaleItem,
  Product,
  StockMovement,
} from "@/types/domain";

type PosWorkspaceProps = {
  products: Product[];
  customers: Customer[];
};

type SaleLine = DraftSaleItem & {
  product: Product;
  grossCents: number;
  vatCents: number;
};

const roleOptions: AppRole[] = ["cashier", "manager", "admin"];

export function PosWorkspace({
  products: initialProducts,
  customers,
}: PosWorkspaceProps) {
  const [products, setProducts] = useState(initialProducts);
  const [role, setRole] = useState<AppRole>("manager");
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [draftItems, setDraftItems] = useState<DraftSaleItem[]>([]);
  const [sales, setSales] = useState<CompletedSale[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [statusMessage, setStatusMessage] = useState(
    "Fiscal connector: not connected",
  );
  const [stockAdjustment, setStockAdjustment] = useState<StockAdjustmentValues>(
    {
      productId: initialProducts[0]?.id ?? "",
      quantityDelta: 1,
      note: "",
    },
  );

  const productForm = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      sku: "",
      name: "",
      unit: "vnt.",
      vatRateBps: 2_100,
      salePriceCents: 0,
      stock: 0,
      minStock: 0,
    },
  });

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      if (!product.active) {
        return false;
      }

      return (
        product.sku.toLowerCase().includes(query) ||
        product.name.toLowerCase().includes(query)
      );
    });
  }, [products, search]);

  const saleLines = useMemo<SaleLine[]>(() => {
    return draftItems
      .map((item) => {
        const product = products.find((candidate) => candidate.id === item.productId);

        if (!product) {
          return null;
        }

        const grossCents = Math.round(product.salePriceCents * item.quantity);
        const vatCents = calculateVatFromGross(grossCents, product.vatRateBps);

        return {
          ...item,
          product,
          grossCents,
          vatCents,
        };
      })
      .filter((line): line is SaleLine => line !== null);
  }, [draftItems, products]);

  const totals = useMemo(() => {
    const grossCents = saleLines.reduce((sum, line) => sum + line.grossCents, 0);
    const vatCents = saleLines.reduce((sum, line) => sum + line.vatCents, 0);

    return {
      grossCents,
      netCents: grossCents - vatCents,
      vatCents,
    };
  }, [saleLines]);

  const lowStockProducts = products.filter(
    (product) => product.active && product.stock <= product.minStock,
  );
  const canEditCatalog = canManageProducts(role);
  const canEditStock = canAdjustStock(role);
  const canVoidSale = canVoidCompletedSale(role);

  function addToDraft(productId: string) {
    setDraftItems((currentItems) => {
      const existing = currentItems.find((item) => item.productId === productId);

      if (existing) {
        return currentItems.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [...currentItems, { productId, quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, quantity: number) {
    setDraftItems((currentItems) =>
      currentItems
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.max(0, quantity) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function removeDraftItem(productId: string) {
    setDraftItems((currentItems) =>
      currentItems.filter((item) => item.productId !== productId),
    );
  }

  function completeSale() {
    if (saleLines.length === 0) {
      setStatusMessage("Add at least one product before completing a sale.");
      return;
    }

    const overdrawn = saleLines.find((line) => line.quantity > line.product.stock);

    if (overdrawn) {
      setStatusMessage(`${overdrawn.product.name} does not have enough stock.`);
      return;
    }

    const timestamp = new Date().toISOString();
    const selectedCustomer =
      customers.find((customer) => customer.id === customerId) ?? customers[0];
    const saleNumber = `LOCAL-${String(sales.length + 1).padStart(4, "0")}`;

    setProducts((currentProducts) =>
      currentProducts.map((product) => {
        const line = saleLines.find((candidate) => candidate.productId === product.id);

        if (!line) {
          return product;
        }

        return { ...product, stock: product.stock - line.quantity };
      }),
    );

    setSales((currentSales) => [
      {
        id: crypto.randomUUID(),
        number: saleNumber,
        customerName: selectedCustomer?.name ?? "Walk-in customer",
        itemCount: saleLines.reduce((sum, line) => sum + line.quantity, 0),
        totalCents: totals.grossCents,
        status: "completed",
        createdAt: timestamp,
      },
      ...currentSales,
    ]);

    setStockMovements((currentMovements) => [
      ...saleLines.map((line) => ({
        id: crypto.randomUUID(),
        productId: line.product.id,
        productName: line.product.name,
        quantityDelta: -line.quantity,
        reason: "sale" as const,
        createdAt: timestamp,
        note: saleNumber,
      })),
      ...currentMovements,
    ]);

    setDraftItems([]);
    setStatusMessage(
      `${saleNumber} completed locally. Fiscal connector remains not connected.`,
    );
  }

  function cancelDraft() {
    setDraftItems([]);
    setStatusMessage("Draft sale cancelled.");
  }

  function voidSale(saleId: string) {
    if (!canVoidSale) {
      setStatusMessage("Only managers and admins can void completed sales.");
      return;
    }

    setSales((currentSales) =>
      currentSales.map((sale) =>
        sale.id === saleId ? { ...sale, status: "voided" } : sale,
      ),
    );
    setStatusMessage("Sale marked as voided in the local preview.");
  }

  function createProduct(values: ProductFormValues) {
    setProducts((currentProducts) => [
      {
        id: crypto.randomUUID(),
        active: true,
        ...values,
      },
      ...currentProducts,
    ]);
    productForm.reset();
    setStatusMessage("Product added to the local catalog.");
  }

  function applyStockAdjustment() {
    const parsed = stockAdjustmentSchema.safeParse(stockAdjustment);

    if (!parsed.success) {
      setStatusMessage(parsed.error.issues[0]?.message ?? "Invalid adjustment.");
      return;
    }

    if (!canEditStock) {
      setStatusMessage("Only managers and admins can adjust stock.");
      return;
    }

    const product = products.find(
      (candidate) => candidate.id === parsed.data.productId,
    );

    if (!product) {
      setStatusMessage("Choose a product before saving stock.");
      return;
    }

    const nextStock = product.stock + parsed.data.quantityDelta;

    if (nextStock < 0) {
      setStatusMessage("Stock cannot be adjusted below zero.");
      return;
    }

    const timestamp = new Date().toISOString();

    setProducts((currentProducts) =>
      currentProducts.map((currentProduct) =>
        currentProduct.id === product.id
          ? { ...currentProduct, stock: nextStock }
          : currentProduct,
      ),
    );

    setStockMovements((currentMovements) => [
      {
        id: crypto.randomUUID(),
        productId: product.id,
        productName: product.name,
        quantityDelta: parsed.data.quantityDelta,
        reason: "manual_adjustment",
        createdAt: timestamp,
        note: parsed.data.note,
      },
      ...currentMovements,
    ]);

    setStatusMessage("Stock adjustment saved locally.");
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="border-b bg-card px-4 py-5 lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
            <ReceiptText className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold">ASPA POS</p>
            <p className="text-xs text-muted-foreground">Supabase starter</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <div className="rounded-md border bg-background p-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Active role
            </p>
            <div className="mt-3 grid gap-2">
              {roleOptions.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={role === option ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRole(option)}
                  className="justify-start capitalize"
                >
                  <ShieldAlert data-icon="inline-start" aria-hidden="true" />
                  {option}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-md border bg-background p-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Fiscal status
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="outline">NOT_CONNECTED</Badge>
            </div>
            <p className="mt-3 text-sm leading-5 text-muted-foreground">
              ASPA AM-1 connector is mocked until official integration docs are
              available.
            </p>
          </div>
        </div>
      </aside>

      <section className="p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">
                Sales register
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{statusMessage}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
              <Metric label="Draft total" value={formatMoney(totals.grossCents)} />
              <Metric label="VAT" value={formatMoney(totals.vatCents)} />
              <Metric label="Low stock" value={String(lowStockProducts.length)} />
            </div>
          </div>

          <Tabs defaultValue="sales">
            <TabsList className="grid w-full grid-cols-4 lg:w-[620px]">
              <TabsTrigger value="sales">
                <ShoppingCart data-icon="inline-start" aria-hidden="true" />
                Sales
              </TabsTrigger>
              <TabsTrigger value="products">
                <Boxes data-icon="inline-start" aria-hidden="true" />
                Products
              </TabsTrigger>
              <TabsTrigger value="stock">
                <Archive data-icon="inline-start" aria-hidden="true" />
                Stock
              </TabsTrigger>
              <TabsTrigger value="reports">
                <ChartNoAxesCombined data-icon="inline-start" aria-hidden="true" />
                Reports
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sales">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
                <Card>
                  <CardHeader>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <CardTitle>Product lookup</CardTitle>
                        <CardDescription>
                          Search by SKU or product name.
                        </CardDescription>
                      </div>
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search products"
                        className="lg:max-w-xs"
                        aria-label="Search products"
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Stock</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProducts.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell className="font-mono text-xs">
                              {product.sku}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{product.name}</div>
                              <div className="text-xs text-muted-foreground">
                                VAT {product.vatRateBps / 100}%
                              </div>
                            </TableCell>
                            <TableCell>
                              <StockBadge product={product} />
                            </TableCell>
                            <TableCell>{formatMoney(product.salePriceCents)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => addToDraft(product.id)}
                                disabled={product.stock <= 0}
                              >
                                <Plus data-icon="inline-start" aria-hidden="true" />
                                Add
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Current sale</CardTitle>
                    <CardDescription>
                      Totals here are a preview; PostgreSQL recalculates them.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="customer">Customer</Label>
                        <select
                          id="customer"
                          value={customerId}
                          onChange={(event) => setCustomerId(event.target.value)}
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {customers.map((customer) => (
                            <option key={customer.id} value={customer.id}>
                              {customer.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-3">
                        {saleLines.length === 0 ? (
                          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                            No items in the draft sale.
                          </div>
                        ) : (
                          saleLines.map((line) => (
                            <div
                              key={line.productId}
                              className="grid grid-cols-[1fr_88px_36px] items-center gap-3 rounded-md border p-3"
                            >
                              <div>
                                <p className="text-sm font-medium">
                                  {line.product.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatMoney(line.product.salePriceCents)} each
                                </p>
                              </div>
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={line.quantity}
                                aria-label={`Quantity for ${line.product.name}`}
                                onChange={(event) =>
                                  changeQuantity(
                                    line.productId,
                                    Number(event.target.value),
                                  )
                                }
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-label={`Remove ${line.product.name}`}
                                onClick={() => removeDraftItem(line.productId)}
                              >
                                <Trash2 aria-hidden="true" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="rounded-md bg-muted p-4">
                        <SummaryRow label="Net" value={formatMoney(totals.netCents)} />
                        <SummaryRow label="VAT" value={formatMoney(totals.vatCents)} />
                        <SummaryRow
                          label="Total"
                          value={formatMoney(totals.grossCents)}
                          strong
                        />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Button type="button" onClick={completeSale}>
                          <CheckCircle2 data-icon="inline-start" aria-hidden="true" />
                          Complete
                        </Button>
                        <Button type="button" variant="outline" onClick={cancelDraft}>
                          <RotateCcw data-icon="inline-start" aria-hidden="true" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="products">
              <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
                <Card>
                  <CardHeader>
                    <CardTitle>Add product</CardTitle>
                    <CardDescription>
                      Managers and admins can maintain catalog records.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form
                      className="flex flex-col gap-4"
                      onSubmit={productForm.handleSubmit(createProduct)}
                    >
                      <FieldError message={productForm.formState.errors.sku?.message}>
                        <Label htmlFor="sku">SKU</Label>
                        <Input id="sku" {...productForm.register("sku")} />
                      </FieldError>
                      <FieldError message={productForm.formState.errors.name?.message}>
                        <Label htmlFor="name">Name</Label>
                        <Input id="name" {...productForm.register("name")} />
                      </FieldError>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FieldError
                          message={productForm.formState.errors.salePriceCents?.message}
                        >
                          <Label htmlFor="salePriceCents">Price cents</Label>
                          <Input
                            id="salePriceCents"
                            type="number"
                            min="0"
                            {...productForm.register("salePriceCents", {
                              valueAsNumber: true,
                            })}
                          />
                        </FieldError>
                        <FieldError
                          message={productForm.formState.errors.vatRateBps?.message}
                        >
                          <Label htmlFor="vatRateBps">VAT bps</Label>
                          <Input
                            id="vatRateBps"
                            type="number"
                            min="0"
                            {...productForm.register("vatRateBps", {
                              valueAsNumber: true,
                            })}
                          />
                        </FieldError>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="grid gap-2">
                          <Label htmlFor="unit">Unit</Label>
                          <select
                            id="unit"
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            {...productForm.register("unit")}
                          >
                            <option value="vnt.">vnt.</option>
                            <option value="kg">kg</option>
                            <option value="m">m</option>
                          </select>
                        </div>
                        <FieldError
                          message={productForm.formState.errors.stock?.message}
                        >
                          <Label htmlFor="stock">Stock</Label>
                          <Input
                            id="stock"
                            type="number"
                            min="0"
                            step="0.001"
                            {...productForm.register("stock", {
                              valueAsNumber: true,
                            })}
                          />
                        </FieldError>
                        <FieldError
                          message={productForm.formState.errors.minStock?.message}
                        >
                          <Label htmlFor="minStock">Min</Label>
                          <Input
                            id="minStock"
                            type="number"
                            min="0"
                            step="0.001"
                            {...productForm.register("minStock", {
                              valueAsNumber: true,
                            })}
                          />
                        </FieldError>
                      </div>
                      <Button type="submit" disabled={!canEditCatalog}>
                        <Plus data-icon="inline-start" aria-hidden="true" />
                        Save product
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Catalog</CardTitle>
                    <CardDescription>
                      Product prices are stored and validated as cents.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead>VAT</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Stock</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell className="font-mono text-xs">
                              {product.sku}
                            </TableCell>
                            <TableCell>{product.name}</TableCell>
                            <TableCell>{product.unit}</TableCell>
                            <TableCell>{product.vatRateBps / 100}%</TableCell>
                            <TableCell>{formatMoney(product.salePriceCents)}</TableCell>
                            <TableCell>
                              {product.stock.toFixed(3)} {product.unit}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="stock">
              <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
                <Card>
                  <CardHeader>
                    <CardTitle>Stock adjustment</CardTitle>
                    <CardDescription>
                      Manual adjustments are manager-only operations.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="stockProduct">Product</Label>
                        <select
                          id="stockProduct"
                          value={stockAdjustment.productId}
                          onChange={(event) =>
                            setStockAdjustment((current) => ({
                              ...current,
                              productId: event.target.value,
                            }))
                          }
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.sku} - {product.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="quantityDelta">Quantity change</Label>
                        <Input
                          id="quantityDelta"
                          type="number"
                          step="0.001"
                          value={stockAdjustment.quantityDelta}
                          onChange={(event) =>
                            setStockAdjustment((current) => ({
                              ...current,
                              quantityDelta: Number(event.target.value),
                            }))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="adjustmentNote">Note</Label>
                        <Input
                          id="adjustmentNote"
                          value={stockAdjustment.note ?? ""}
                          onChange={(event) =>
                            setStockAdjustment((current) => ({
                              ...current,
                              note: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={applyStockAdjustment}
                        disabled={!canEditStock}
                      >
                        <ClipboardList data-icon="inline-start" aria-hidden="true" />
                        Save adjustment
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Movement history</CardTitle>
                    <CardDescription>
                      Sale and adjustment rows mirror the database audit shape.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Change</TableHead>
                          <TableHead>Note</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockMovements.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="h-24 text-center text-muted-foreground"
                            >
                              No stock movements yet.
                            </TableCell>
                          </TableRow>
                        ) : (
                          stockMovements.map((movement) => (
                            <TableRow key={movement.id}>
                              <TableCell className="font-mono text-xs">
                                {new Date(movement.createdAt).toLocaleString()}
                              </TableCell>
                              <TableCell>{movement.productName}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{movement.reason}</Badge>
                              </TableCell>
                              <TableCell>{movement.quantityDelta}</TableCell>
                              <TableCell>{movement.note}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="reports">
              <div className="grid gap-5 xl:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Sales today</CardTitle>
                    <CardDescription>Completed local preview sales.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-2">
                      <CircleDollarSign className="size-6 text-muted-foreground" />
                      <p className="text-3xl font-semibold">
                        {formatMoney(
                          sales
                            .filter((sale) => sale.status === "completed")
                            .reduce((sum, sale) => sum + sale.totalCents, 0),
                        )}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Low stock</CardTitle>
                    <CardDescription>Products at or below minimum.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-3">
                      {lowStockProducts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No products require attention.
                        </p>
                      ) : (
                        lowStockProducts.map((product) => (
                          <div
                            key={product.id}
                            className="flex items-center justify-between rounded-md border p-3"
                          >
                            <span className="text-sm font-medium">{product.name}</span>
                            <StockBadge product={product} />
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Completed sales</CardTitle>
                    <CardDescription>Manager void action is role gated.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-3">
                      {sales.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No completed sales yet.
                        </p>
                      ) : (
                        sales.map((sale) => (
                          <div key={sale.id} className="rounded-md border p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium">{sale.number}</p>
                                <p className="text-xs text-muted-foreground">
                                  {sale.customerName}
                                </p>
                              </div>
                              <Badge
                                variant={
                                  sale.status === "voided"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {sale.status}
                              </Badge>
                            </div>
                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-sm">
                                {formatMoney(sale.totalCents)}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!canVoidSale || sale.status === "voided"}
                                onClick={() => voidSale(sale.id)}
                              >
                                Void
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
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
  const isLow = product.stock <= product.minStock;

  return (
    <Badge variant={isLow ? "destructive" : "secondary"}>
      {product.stock.toFixed(3)} {product.unit}
    </Badge>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={strong ? "text-sm font-semibold" : "text-sm"}>
        {label}
      </span>
      <span className={strong ? "text-base font-semibold" : "text-sm"}>
        {value}
      </span>
    </div>
  );
}

function FieldError({
  children,
  message,
}: {
  children: React.ReactNode;
  message?: string;
}) {
  return (
    <div className="grid gap-2">
      {children}
      {message ? <p className="text-xs text-destructive">{message}</p> : null}
    </div>
  );
}
