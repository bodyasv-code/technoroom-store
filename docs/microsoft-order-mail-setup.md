# Microsoft 365 order notifications — setup progress

Date: 2026-10-14. Website integration prepared; live test delivery pending.

- Sender and recipient authorized by user: office@tehnoroom.com.ua (without c).
- Tenant: ac889dad-6a53-42d4-83ec-bc5e771daaa0.
- Application: TECHNOROOM Order Notifications.
- Application/client ID: a4d3b3b5-81a1-4c45-bed7-89660a65d64e.
- Enterprise service principal object ID: 91e33724-cf56-4e74-b7a3-0bfe4b10fb8c.
- App-registration object ID (NOT Exchange principal ID): 206703c8-70af-4236-b1f0-ac620dd0f3d2.

After user approval and administrator sign-in, Exchange configuration was applied:

```powershell
New-ServicePrincipal -AppId 'a4d3b3b5-81a1-4c45-bed7-89660a65d64e' -ObjectId '91e33724-cf56-4e74-b7a3-0bfe4b10fb8c' -DisplayName 'TECHNOROOM Order Notifications'
New-ManagementScope -Name 'TECHNOROOM-Office-Only' -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'office@tehnoroom.com.ua'"
New-ManagementRoleAssignment -Name 'TECHNOROOM-Office-MailSend' -Role 'Application Mail.Send' -App '91e33724-cf56-4e74-b7a3-0bfe4b10fb8c' -CustomResourceScope 'TECHNOROOM-Office-Only'
```

These are records of completed actions, NOT a script to rerun blindly.
Mailbox filter was verified to match only Office, a SharedMailbox.
Test-ServicePrincipalAuthorization confirmed Mail.Send InScope=True for office,
InScope=False for bogdan@tehnoroom.com.ua. No Mail.Read or Mail.ReadWrite role assigned.
Entra Configured permissions showed only default delegated User.Read; no unscoped
application Mail.Send grant was added. Do not add it: Entra and RBAC grants are additive.

Reference: https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac

Credential creation must be completed by the user. Do not paste secrets into chat,
commit them, include them in screenshots or expose them in public/supabase-config.js.
Store website credentials only in protected server-side deployment environment variables.
Do not claim notifications work until a test notification reaches the specified recipient.

The user confirmed creation of the secret and its storage in Vercel Production as
MS_GRAPH_CLIENT_SECRET. Its value was not requested or read by the assistant.
Application and tenant IDs are server-side constants; no other environment variables
are needed. A new deployment is required to pick up the Production secret.

Orders API sends only after create_store_order_v2 succeeds. Message contains order ID,
authoritative stored total/lines and an admin link, not customer names, contacts or
addresses. Microsoft token/mail requests time out after 8 seconds each.
Mail failures do not return order failure: status/code are stored in checkout_details.notification
and shown in the order detail dialog. No automatic email retries are implemented;
retrying an ambiguous send could duplicate a notification. 202 means accepted, not delivered.

Test endpoint POST /api/test-order-mail requires a valid Supabase session and an admin
profile; sender/recipient/content are fixed, not supplied by the request. It creates no
order and changes no stock. Use «Перевірити email-сповіщення» in Admin → Orders.
An in-memory one-minute test throttle is a per-instance safeguard, not a global rate limit.

On 2026-10-14 the user confirmed receipt of the test email in office@tehnoroom.com.ua.
Admin order details now show separate delivery, payment and company blocks. Legacy
orders without structured metadata show unknown methods/status rather than guessed data.
Manual retry POST /api/retry-order-mail requires an authenticated admin profile and
explicit acknowledgement of a possible duplicate. Accepted or unknown notifications
cannot be retried. An atomic metadata lease prevents concurrent retries; an interrupted
lease expires after five minutes. Recipients remain fixed server-side. Changing an order
status updates only status/manager_note, with an original-status concurrency guard;
it does not send email or alter order items, totals or stock.

References:
- https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow
