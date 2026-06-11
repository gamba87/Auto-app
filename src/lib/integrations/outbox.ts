import { z } from "zod";

export const fiscalSalePayloadSchema = z.object({
  saleId: z.uuid(),
  saleNumber: z.string().min(1),
  totalCents: z.number().int().min(0),
  event: z.enum(["sale.completed", "sale.voided"]),
});

export type FiscalSalePayload = z.infer<typeof fiscalSalePayloadSchema>;
