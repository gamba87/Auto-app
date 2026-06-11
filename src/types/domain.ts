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
};

export type DraftSaleItem = {
  productId: string;
  quantity: number;
};

export type CompletedSale = {
  id: string;
  number: string;
  customerName: string;
  itemCount: number;
  totalCents: MoneyCents;
  status: "completed" | "voided";
  createdAt: string;
};

export type StockMovement = {
  id: string;
  productId: string;
  productName: string;
  quantityDelta: number;
  reason: "manual_adjustment" | "sale" | "void";
  createdAt: string;
  note?: string;
};
