import type {
  CompletedSale,
  CompletedSaleLine,
  Product,
  StockMovement,
} from "@/types/domain";

export type LocalSaleLine = {
  product: Product;
  quantity: number;
  grossCents: number;
  vatCents: number;
};

export function applyStockMovement(
  products: Product[],
  movement: StockMovement,
): Product[] {
  let productFound = false;
  const nextProducts = products.map((product) => {
    if (product.id !== movement.productId) {
      return product;
    }

    productFound = true;
    const nextStock = product.stock + movement.quantityDelta;

    if (nextStock < 0) {
      throw new Error(`${product.name} stock cannot be negative.`);
    }

    return { ...product, stock: nextStock };
  });

  if (!productFound) {
    throw new Error(`Product ${movement.productName} is missing from the catalog.`);
  }

  return nextProducts;
}

export function applyStockMovements(
  products: Product[],
  movements: StockMovement[],
): Product[] {
  return movements.reduce(applyStockMovement, products);
}

export function createCompletedSale(input: {
  id: string;
  number: string;
  customerName: string;
  createdAt: string;
  lines: LocalSaleLine[];
  totalCents: number;
}): CompletedSale {
  const lines: CompletedSaleLine[] = input.lines.map((line) => ({
    productId: line.product.id,
    productName: line.product.name,
    quantity: line.quantity,
    unitPriceCents: line.product.salePriceCents,
    grossCents: line.grossCents,
    vatCents: line.vatCents,
  }));

  return {
    id: input.id,
    number: input.number,
    customerName: input.customerName,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    totalCents: input.totalCents,
    status: "completed",
    createdAt: input.createdAt,
    lines,
  };
}

export function createSaleStockMovements(input: {
  sale: CompletedSale;
  createdAt: string;
  makeId: () => string;
}): StockMovement[] {
  return input.sale.lines.map((line) => ({
    id: input.makeId(),
    productId: line.productId,
    productName: line.productName,
    quantityDelta: -line.quantity,
    reason: "sale",
    createdAt: input.createdAt,
    note: input.sale.number,
  }));
}

export function voidCompletedSale(input: {
  sale: CompletedSale;
  products: Product[];
  reason: string;
  voidedAt: string;
  makeId: () => string;
}): {
  sale: CompletedSale;
  products: Product[];
  stockMovements: StockMovement[];
} {
  if (input.sale.status !== "completed") {
    throw new Error("Only completed sales can be voided.");
  }

  const stockMovements = input.sale.lines.map((line) => ({
    id: input.makeId(),
    productId: line.productId,
    productName: line.productName,
    quantityDelta: line.quantity,
    reason: "void" as const,
    createdAt: input.voidedAt,
    note: input.reason,
  }));

  return {
    sale: {
      ...input.sale,
      status: "voided",
      voidedAt: input.voidedAt,
      voidReason: input.reason,
    },
    products: applyStockMovements(input.products, stockMovements),
    stockMovements,
  };
}
