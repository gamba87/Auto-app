import { z } from "zod";

export const productFormSchema = z.object({
  sku: z.string().trim().min(2).max(32),
  name: z.string().trim().min(2).max(120),
  unit: z.enum(["vnt.", "kg", "m"]),
  vatRateBps: z.number().int().min(0).max(10_000),
  salePriceCents: z.number().int().min(0).max(100_000_000),
  stock: z.number().min(0).max(1_000_000),
  minStock: z.number().min(0).max(1_000_000),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
