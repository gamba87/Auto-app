# ASPA POS Starter

TypeScript starter for a POS and stock application using Next.js App Router and Supabase. It follows the attached architecture: the web app handles product, sale, stock, and reporting workflows; Supabase owns data, auth, RLS, audit history, and atomic stock-changing RPCs; ASPA AM-1 fiscal integration is isolated behind a mock connector until official integration documentation is available.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS, shadcn-style source components
- Supabase PostgreSQL, Auth, RLS, Edge Functions
- Zod and React Hook Form for validation
- Vitest, Playwright, and SQL database tests

## Important boundaries

- Money is stored as integer cents in TypeScript and PostgreSQL.
- Quantities use `numeric(12,3)` in PostgreSQL.
- `SUPABASE_SERVICE_ROLE_KEY` is only referenced by server-side code and Edge Functions.
- Stock changes happen through PostgreSQL RPCs: `complete_sale`, `cancel_draft_sale`, `void_completed_sale`, and `adjust_stock`.
- Fiscal outbox event names use lower-case dot notation: `sale.completed` and `sale.voided`.
- `integration_outbox` is infrastructure data. Sales RPCs write it through private `SECURITY DEFINER` functions; cashier sessions should not read those rows directly.
- Draft cancellations store a required reason on `sales.cancel_reason` and in `audit_events`; they do not create fiscal outbox events because no fiscal sale was completed.
- Fiscal hardware code is not implemented in v1. The app uses `FiscalConnector` and `MockFiscalConnector`.

## Local setup

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Add your Supabase URL and keys to `.env.local`. Do not commit `.env.local`.

## Supabase

Apply the migration in `supabase/migrations/20260611075052_initial_pos_schema.sql` to create:

- `products`
- `customers`
- `sales`
- `sale_items`
- `stock_movements`
- `integration_outbox`
- `audit_events`
- RLS policies and transaction-safe RPC functions

The Edge Function in `supabase/functions/process-fiscal-outbox` marks pending fiscal events as failed with `NOT_CONNECTED`. Replace the mock only after ASPA confirms the official integration method.

## Checks

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
```

Database tests live in `supabase/tests/database` and are intended for a local Supabase test database.
