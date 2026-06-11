import { z } from "zod";

export const draftSaleItemSchema = z.object({
  productId: z.uuid(),
  quantity: z.coerce.number().positive().max(100_000),
});

export const completeSaleRequestSchema = z.object({
  saleId: z.uuid(),
  customerId: z.uuid().nullable().optional(),
  items: z.array(draftSaleItemSchema).min(1),
});

export const voidSaleSchema = z.object({
  saleId: z.uuid(),
  reason: z.string().trim().min(5).max(500),
});

export type CompleteSaleRequest = z.infer<typeof completeSaleRequestSchema>;
