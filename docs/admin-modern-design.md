# Admin design — 21.10.2026

User approved the storefront direction and requested immediate publication of
both storefront and admin design. Add only admin-modern.css and a body opt-in
class/font stylesheet to admin.html. No admin scripts, access policies, actions,
API, SQL or user data are changed by this design pass.

Direction matches the storefront: neutral pale background, Manrope typography,
white sidebar and surfaces, blue primary buttons, distinct red destructive actions,
44px form controls, consistent table spacing and rounded forms. Sidebar section
links remain on desktop; the existing JS section picker remains the navigation
on mobile. Tables keep horizontal scrolling rather than hiding action columns.
Hidden login, recovery and application views remain hidden until existing auth
code selects a view. Native dialog showModal behavior is retained.

Validation: full Node regression suite plus structural isolation/hidden-state
checks. Browser automation was unavailable during the design pass; screenshots
and interactive desktop/mobile rendering are not verified. Publication was
explicitly requested by the user; verify deployed public assets without claiming
authenticated UI or visual verification.
