# TECHNOROOM production setup

This project is separate from the old `tehnoroom.com.ua` site. It is intended for the new `technoroom.com.ua` domain.

## One-time account setup

1. Create a Supabase project and keep its dashboard owner account under the business email.
2. In **SQL Editor**, run `supabase/schema.sql`.
3. In **Authentication**, invite the first administrator by email, then insert their profile in SQL:

```sql
insert into public.profiles (id, role, full_name)
values ('AUTH_USER_UUID', 'owner', 'Owner name');
```

4. Create a Vercel project from this directory. Add the two values from `.env.example` as Vercel environment variables. Do not place the secret key in HTML, browser JavaScript, or a Git repository.
5. In Vercel, add `technoroom.com.ua` and apply the DNS records Vercel displays at the registrar where that domain is managed.

## Security model

- Visitors can only read active products.
- Orders are accepted by `api/orders.js`; it rechecks item availability and prices in the database.
- Admins sign in with Supabase Auth and can manage data only after an owner creates their profile.
- The secret key is server-only and bypasses row-level security, so it must never be exposed to the client.

## Before public launch

- Connect the storefront and admin UI to Supabase.
- Add image upload to Supabase Storage.
- Configure a transactional email provider for order notices.
- Test database backup/restore and a real order in a test environment.

