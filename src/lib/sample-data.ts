import type { Customer, Product } from "@/types/domain";

export const initialProducts: Product[] = [
  {
    id: "prod_001",
    sku: "CAB-001",
    name: "Cable 3 m",
    unit: "vnt.",
    vatRateBps: 2_100,
    salePriceCents: 1299,
    stock: 42,
    minStock: 10,
    active: true,
  },
  {
    id: "prod_002",
    sku: "LMP-014",
    name: "LED work lamp",
    unit: "vnt.",
    vatRateBps: 2_100,
    salePriceCents: 3499,
    stock: 18,
    minStock: 6,
    active: true,
  },
  {
    id: "prod_003",
    sku: "BAT-009",
    name: "Battery pack",
    unit: "vnt.",
    vatRateBps: 2_100,
    salePriceCents: 5990,
    stock: 7,
    minStock: 8,
    active: true,
  },
  {
    id: "prod_004",
    sku: "TPE-020",
    name: "Measuring tape",
    unit: "vnt.",
    vatRateBps: 2_100,
    salePriceCents: 850,
    stock: 31,
    minStock: 12,
    active: true,
  },
];

export const initialCustomers: Customer[] = [
  { id: "walk_in", name: "Walk-in customer" },
  { id: "cust_001", name: "UAB Demo partner", email: "finance@example.com" },
];
