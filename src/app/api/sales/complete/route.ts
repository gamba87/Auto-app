import { NextResponse } from "next/server";
import { getFiscalConnector } from "@/lib/integrations/fiscal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { completeSaleRequestSchema } from "@/lib/validation/sale";

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const payload = completeSaleRequestSchema.pick({ saleId: true }).safeParse(json);

  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid sale completion payload." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("complete_sale", {
    p_sale_id: payload.data.saleId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const fiscal = await getFiscalConnector().submitSale(payload.data.saleId);

  return NextResponse.json({
    sale: data,
    fiscal,
  });
}
