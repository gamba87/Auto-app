import { z } from "zod";

export const stockAdjustmentSchema = z.object({
  productId: z.string().min(1),
  quantityDelta: z.coerce.number().refine((value) => value !== 0, {
    message: "Quantity change cannot be zero.",
  }),
  note: z.string().trim().max(300).optional(),
});

export type StockAdjustmentValues = z.infer<typeof stockAdjustmentSchema>;
