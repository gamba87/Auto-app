import type { MoneyCents } from "@/lib/money";

export type AppRole = "cashier" | "manager" | "admin";

export type Product = {
  id: string;
  sku: string;
  name: string;
  unit: "vnt." | "kg" | "m";
  vatRateBps: number;
  salePriceCents: MoneyCents;
  stock: number;
  minStock: number;
  active: boolean;
};

export type Customer = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
};

export type DraftSaleItem = {
  productId: string;
  quantity: number;
};

export type CompletedSaleLine = {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: MoneyCents;
  grossCents: MoneyCents;
  vatCents: MoneyCents;
};

export type CompletedSale = {
  id: string;
  number: string;
  customerName: string;
  itemCount: number;
  totalCents: MoneyCents;
  status: "completed" | "voided";
  createdAt: string;
  voidedAt?: string;
  voidReason?: string;
  lines: CompletedSaleLine[];
};

export type StockMovement = {
  id: string;
  productId: string;
  productName: string;
  quantityDelta: number;
  reason: "manual_adjustment" | "sale" | "void" | "import";
  createdAt: string;
  note?: string;
};
