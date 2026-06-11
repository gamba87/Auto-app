import { describe, expect, it } from "vitest";
import {
  applyStockMovements,
  createCompletedSale,
  createSaleStockMovements,
  voidCompletedSale,
} from "@/lib/pos-ledger";
import { calculateVatFromGross } from "@/lib/money";
import type { Product } from "@/types/domain";

const product: Product = {
  id: "10000000-0000-4000-8000-000000000001",
  sku: "TEST-VOID-001",
  name: "Void test product",
  unit: "vnt.",
  vatRateBps: 2_100,
  salePriceCents: 1_000,
  stock: 10,
  minStock: 1,
  active: true,
};

describe("local POS stock ledger", () => {
  it("keeps sale movements intact and restores stock with a void movement", () => {
    const sale = createCompletedSale({
      id: "sale-001",
      number: "LOCAL-0001",
      customerName: "Demo customer",
      createdAt: "2026-06-11T08:00:00.000Z",
      totalCents: 2_000,
      lines: [
        {
          product,
          quantity: 2,
          grossCents: 2_000,
          vatCents: calculateVatFromGross(2_000, product.vatRateBps),
        },
      ],
    });
    const saleMovements = createSaleStockMovements({
      sale,
      createdAt: sale.createdAt,
      makeId: () => "movement-sale-001",
    });
    const productsAfterSale = applyStockMovements([product], saleMovements);

    expect(productsAfterSale[0]?.stock).toBe(8);
    expect(saleMovements).toEqual([
      expect.objectContaining({
        id: "movement-sale-001",
        productId: product.id,
        quantityDelta: -2,
        reason: "sale",
      }),
    ]);

    const voidResult = voidCompletedSale({
      sale,
      products: productsAfterSale,
      reason: "Customer return",
      voidedAt: "2026-06-11T08:10:00.000Z",
      makeId: () => "movement-void-001",
    });

    expect(voidResult.products[0]?.stock).toBe(10);
    expect(saleMovements[0]).toEqual(
      expect.objectContaining({
        id: "movement-sale-001",
        quantityDelta: -2,
        reason: "sale",
      }),
    );
    expect(voidResult.stockMovements).toEqual([
      expect.objectContaining({
        id: "movement-void-001",
        productId: product.id,
        quantityDelta: 2,
        reason: "void",
        note: "Customer return",
      }),
    ]);
    expect(voidResult.sale.status).toBe("voided");
  });
});
