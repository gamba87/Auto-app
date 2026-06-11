import { createClient } from "@supabase/supabase-js";

type OutboxEvent = {
  id: string;
  attempts: number;
  payload: {
    saleId?: string;
    event?: string;
  };
};

const notConnectedMessage =
  "ASPA AM-1 integration has not been configured yet.";

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      { error: "Missing Supabase Edge Function environment variables." },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase
    .from("integration_outbox")
    .select("id, attempts, payload")
    .eq("status", "pending")
    .lte("available_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(10)
    .returns<OutboxEvent[]>();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  for (const event of data ?? []) {
    await supabase
      .from("integration_outbox")
      .update({
        status: "failed",
        attempts: event.attempts + 1,
        last_error: notConnectedMessage,
      })
      .eq("id", event.id);
  }

  return Response.json({
    processed: data?.length ?? 0,
    status: "NOT_CONNECTED",
    message: notConnectedMessage,
  });
});
