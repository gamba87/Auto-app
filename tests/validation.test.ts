import { describe, expect, it } from "vitest";
import { productFormSchema } from "@/lib/validation/product";
import { completeSaleRequestSchema, voidSaleSchema } from "@/lib/validation/sale";
import { stockAdjustmentSchema } from "@/lib/validation/stock";

const saleId = "11111111-1111-4111-8111-111111111111";
const productId = "22222222-2222-4222-8222-222222222222";

describe("validation schemas", () => {
  it("accepts product values stored in cents", () => {
    expect(
      productFormSchema.parse({
        sku: "ABC-1",
        name: "Demo product",
        unit: "vnt.",
        vatRateBps: 2100,
        salePriceCents: 1299,
        stock: 3,
        minStock: 1,
      }),
    ).toMatchObject({ salePriceCents: 1299 });
  });

  it("requires at least one sale item", () => {
    expect(() =>
      completeSaleRequestSchema.parse({
        saleId,
        items: [],
      }),
    ).toThrow();
  });

  it("accepts sale completion payloads", () => {
    expect(
      completeSaleRequestSchema.parse({
        saleId,
        items: [{ productId, quantity: 2 }],
      }),
    ).toMatchObject({ saleId });
  });

  it("rejects zero stock adjustments", () => {
    expect(() =>
      stockAdjustmentSchema.parse({
        productId,
        quantityDelta: 0,
      }),
    ).toThrow(/cannot be zero/);
  });

  it("requires a meaningful void reason", () => {
    expect(() => voidSaleSchema.parse({ saleId, reason: "bad" })).toThrow();
  });
});
