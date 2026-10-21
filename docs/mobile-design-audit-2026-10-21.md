# Mobile design audit — 21.10.2026

Scope: storefront header, category menu, filters and product detail after the
published visual refresh. No orders, emails, Auth or catalog records are changed.

Browser access failed with `js execution timed out; kernel reset` on getState.
This is a source/style audit, not a completed visual or real-device test.

Confirmed source problems fixed:

- Gallery container retained the desktop height/max-height of 535px at mobile
  breakpoints. Earlier overrides changed only its min-height. Add explicit bounded
  heights (300–440px for tablets, 260–380px up to 700px) and remove competing
  minimum image heights. Keep object-fit containment, image zoom and thumbnails.
- Mobile search inherited a 12px !important rule. Make search/filter/select input
  text 16px on phones, without changing entered values or filter behavior.
- Long SKU values used white-space:nowrap. Allow wrapping, including long product
  titles/specification values, rather than hiding page overflow.
- Specification filter labels lacked a minimum touch target. Add 44px labels and
  20px checkbox controls with wrapping text.

Category menu source already implements safe-area insets, bounded viewport height,
scroll containment, back/close controls, Escape/Tab focus handling and restoration
of body scroll on close. Its markup/logic was not modified by this audit.

Checks: full Node regression suite; additional CSS assertions and numeric bounds
for the clamp rule at 320, 360, 375, 390, 414, 430, 640 and 700px. These calculations
do not establish absence of overflow in a rendered browser. Still needed: phone
screenshots/interactive review of menu, filters, gallery and zoom.
