# Foundations

## Surface authority

Use the token and component vocabulary of the product surface being changed.
For `apps/website`, that means the shipped website, its generated website
inventories, and approved website contracts. The Figma observations below are
secondary evidence for website composition and do not create new variants.

## Live Figma observations

Observed from the Comfy Design Standards file and its subscribed Comfy Design
System library on 2026-08-20. Fetch live nodes before implementation because the
library changes independently of this repository.

- Interactive surfaces become darker on hover in light mode and lighter in
  dark mode. Interactive cursors become pointers. See node `1:2`.
- A normal button or navigation item's entire visible surface is its click
  target. Small node handles and connectors receive a larger invisible target.
  See node `4:243`.
- Figma represents hover and selected demonstration states with suffixed
  variables. Code derives interaction states with semantic utilities and must
  not add Figma-only `-hover` or `-selected` palette tokens verbatim.
- Disabled states use the default semantic role with reduced opacity when the
  component specification does not define a distinct semantic disabled role.
- The semantic surface hierarchy is base, secondary, then tertiary. Use the
  hierarchy to express elevation and containment, not arbitrary lightness.

The standards file currently has two top-level pages: `Start here` (`0:1`) and
`Helper Components -- Ignore` (`63:290`). It subscribes to the published Comfy
Design System library and the Lucide icon library.

## Token model

Use tokens in this order:

1. A component-level semantic token when the component domain already exists.
2. A general semantic token such as base, secondary, destructive, border, or
   muted.
3. A primitive palette token only inside the design-system package while
   defining a semantic role.
4. A new semantic token, added to both theme modes and exposed through Tailwind,
   when no existing role describes the design intent.

Never move a hex, RGB, HSL, or primitive Figma value directly into a Vue
component. Never use `dark:` variants; semantic tokens own theme differences.

The generated [application token inventory](./generated/TOKENS.md) includes
every custom property currently declared by `_palette.css` and `style.css`. The
generated [website token inventory](./generated/WEBSITE_TOKENS.md) covers the
public website theme. Presence in an inventory does not make a token preferred.
Prefer names that describe role rather than hue.

## Typography, spacing, radius, and motion

- Use the Inter interface family and Formula brand family already exposed by
  the theme.
- Use Tailwind's established scale. Arbitrary values require evidence from a
  live specification and should become a token when repeated.
- Use existing component sizes before adding a new size. For example, Button
  owns its supported heights and icon target sizes.
- Preserve visible focus, disabled behavior, and reduced-motion behavior when
  translating a mockup. A still image does not specify these states.
- Size Iconify icons with `size-*`. Text-size utilities do not produce stable
  icon dimensions.

## Accessibility minimums

- Use semantic controls and accessible names.
- Make the complete visible control clickable. Increase small targets without
  changing their visual size when needed.
- Specify default, hover, focus-visible, active or selected, disabled, loading,
  empty, and error states when they apply.
- Treat contrast and keyboard behavior as acceptance criteria, even when the
  mockup omits them.
