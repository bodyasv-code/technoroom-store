# Grouped admin sidebar — 23 October 2026

User approved grouped navigation, left-aligned labels with icons, a compact
collapsible sidebar and footer actions. Implemented in the admin-only visual
layer and a separate DOM enhancement mounted after existing dynamic sections,
admin users and routing. Existing links, badges, logout node and handlers are
moved, not recreated. No business logic, auth, permissions, database or public
storefront behavior changed.

Groups: Магазин, Контент, Постачальники, Налаштування. Desktop collapse retains
accessible link names and title hints; state is stored locally with storage
failure fallback. Mobile retains the existing section picker and readable footer
actions regardless of the stored desktop preference.

Verification:

- All 68 Node test files passed with `node --test --test-concurrency=1 tests/*.test.mjs`.
  The initial concurrent run exhausted memory in two unrelated test workers;
  the sequential run passed those tests as well.
- Chrome local data-free fixture: expanded sidebar, icon-only collapse,
  section navigation and reload persistence checked interactively.
- 390px iframe viewport: mobile header/footer and section picker visually checked.
- Fixture uses actual admin HTML sidebar, inline legacy styles and current CSS
  plus the actual navigation/sidebar modules. It does not run the authenticated
  admin entry point or read production data.
- Production publication and authenticated post-deploy QA have NOT been performed.

Preview: `node scripts/preview-admin-sidebar.mjs`, then open
`http://127.0.0.1:4173/preview#orders` or `/mobile-preview`.
