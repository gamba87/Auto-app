import "server-only";

import { initialProducts } from "@/lib/sample-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { Product } from "@/types/domain";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

type CatalogSource = "demo" | "supabase";

export type ProductCatalogResult = {
  error: string | null;
  products: Product[];
  source: CatalogSource;
};

function toProductUnit(unit: string): Product["unit"] {
  if (unit === "kg" || unit === "m") {
    return unit;
  }

  return "vnt.";
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    active: row.active,
    minStock: Number(row.min_stock),
    name: row.name,
    salePriceCents: row.sale_price_cents,
    sku: row.sku,
    stock: Number(row.stock),
    unit: toProductUnit(row.unit),
    vatRateBps: row.vat_rate_bps,
  };
}

export async function getProductCatalog(
  useDemoData: boolean,
): Promise<ProductCatalogResult> {
  if (useDemoData) {
    return {
      error: null,
      products: initialProducts,
      source: "demo",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, sku, name, unit, vat_rate_bps, sale_price_cents, stock, min_stock, active, created_at, created_by, description, updated_at",
    )
    .order("active", { ascending: false })
    .order("sku", { ascending: true });

  if (error) {
    return {
      error: error.message,
      products: [],
      source: "supabase",
    };
  }

  return {
    error: null,
    products: (data ?? []).map(mapProduct),
    source: "supabase",
  };
}

