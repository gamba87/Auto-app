import "server-only";

import { canAdjustStock } from "@/lib/permissions/roles";
import { getProductCatalog } from "@/lib/products/catalog";
import { initialStockMovements } from "@/lib/sample-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { AppRole, Product } from "@/types/domain";

type StockMovementRow =
  Database["public"]["Tables"]["stock_movements"]["Row"];

export type StockDashboardMovement = {
  createdAt: string;
  id: string;
  note: string | null;
  productName: string;
  productSku: string;
  quantityDelta: number;
  reason: Database["public"]["Enums"]["stock_movement_reason"];
  saleId: string | null;
};

export type StockDashboardResult = {
  canViewMovements: boolean;
  error: string | null;
  movements: StockDashboardMovement[];
  products: Product[];
  source: "demo" | "supabase";
};

function mapMovement(
  row: StockMovementRow,
  productsById: Map<string, Product>,
): StockDashboardMovement {
  const product = productsById.get(row.product_id);

  return {
    createdAt: row.created_at,
    id: row.id,
    note: row.note,
    productName: product?.name ?? "Unknown product",
    productSku: product?.sku ?? row.product_id,
    quantityDelta: Number(row.quantity_delta),
    reason: row.reason,
    saleId: row.sale_id,
  };
}

export async function getStockDashboard(
  role: AppRole,
  useDemoData: boolean,
): Promise<StockDashboardResult> {
  const canViewMovements = canAdjustStock(role);
  const catalog = await getProductCatalog(useDemoData);

  if (catalog.error) {
    return {
      canViewMovements,
      error: catalog.error,
      movements: [],
      products: catalog.products,
      source: catalog.source,
    };
  }

  if (useDemoData) {
    const productsById = new Map(
      catalog.products.map((product) => [product.id, product]),
    );

    return {
      canViewMovements,
      error: null,
      movements: canViewMovements
        ? initialStockMovements.map((movement) => ({
            createdAt: movement.createdAt,
            id: movement.id,
            note: movement.note ?? null,
            productName:
              productsById.get(movement.productId)?.name ??
              movement.productName,
            productSku:
              productsById.get(movement.productId)?.sku ?? movement.productId,
            quantityDelta: movement.quantityDelta,
            reason: movement.reason,
            saleId: null,
          }))
        : [],
      products: catalog.products,
      source: catalog.source,
    };
  }

  if (!canViewMovements) {
    return {
      canViewMovements,
      error: null,
      movements: [],
      products: catalog.products,
      source: catalog.source,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stock_movements")
    .select(
      "id, product_id, warehouse_id, sale_id, quantity_delta, reason, note, created_by, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    return {
      canViewMovements,
      error: error.message,
      movements: [],
      products: catalog.products,
      source: catalog.source,
    };
  }

  const productsById = new Map(
    catalog.products.map((product) => [product.id, product]),
  );

  return {
    canViewMovements,
    error: null,
    movements: (data ?? []).map((row) => mapMovement(row, productsById)),
    products: catalog.products,
    source: catalog.source,
  };
}

