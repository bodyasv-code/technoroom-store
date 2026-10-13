# Checkout pricing release — pending database migration

Prepared locally. NOT published. Existing production orders/API remain unchanged.

1. Run `supabase/checkout-pricing-upgrade.sql` in the project's Supabase SQL Editor.
   It adds nullable orders.checkout_details and service-role-only create_store_order_v2(jsonb).
   It does not call the function, create an order, change stock, or rewrite existing orders.
2. Verify the schema with this read-only query:

   ```sql
   select to_regprocedure('public.create_store_order_v2(jsonb)') as checkout_function;
   select column_name from information_schema.columns
   where table_schema='public' and table_name='orders' and column_name='checkout_details';
   ```

3. Only after migration succeeds, commit/publish the matching API and storefront files together.
4. Verify product 170, catalog and checkout agree at the current active discount.
   Local UI verification on 2026-10-13: 216129.75 per unit; quantity 2 = 432259.50.
5. No real order was placed during local QA. Server handler tested with mocked RPC.
   PostgreSQL function execution/integration has NOT yet been verified.

Pricing uses one active matching promotion, lowest ID first, no stacking; prices round
to two decimals before multiplication by quantity. Client sends expectedUnitPrice only
as a consistency check: SQL recomputes the price from products/promotions and aborts
the transaction if it differs. Stock locks and order creation remain transactional.

Full name and human-readable delivery/payment/company details are kept in existing
admin-visible name/comment fields; checkout_details also retains structured customer,
delivery, payment, company, consent and priced line snapshots.

Still pending from the audit: catalog hover overlay, mobile field overflow and frontend
phone validation. API now rejects an incomplete phone; no claim that the input mask is fixed.
