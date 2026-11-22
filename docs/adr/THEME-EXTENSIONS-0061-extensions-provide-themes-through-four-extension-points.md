# ADR-THEME-EXTENSIONS-0061: Extensions provide themes through four extension points

Date: 2026-11-22

## Status

Proposed

## Context

A built-in theme can now change far more than colours. A palette names a theme
stylesheet that restyles Vue nodes through data-attribute hooks, and a
`LINK_STYLE` palette key draws links in a non-solid style such as chalk. All of
this only works for themes compiled into core.

An extension that wants to ship a theme of the same kind hits four walls:

- `app.extensionManager.colorPalette.addCustomColorPalette` saves the preset
  into the user's `Comfy.CustomColorPalettes`. The next page load reports that
  the id already exists, and uninstalling the extension leaves the palette
  behind. Providing a palette without persisting it is not possible.
- A preset's `stylesheet` is an id that becomes `data-theme` on the document.
  The CSS must be imported by the app at build time. CSS an extension injects
  itself is unlayered, so it outranks every cascade layer, Tailwind utilities
  included, instead of sitting in the `presets` layer with built-in theme
  stylesheets.
- The `data-part` names and the `data-theme`, `data-mode`, `data-error`,
  `data-executing`, `data-collapsed` and `data-node-type` attributes are what
  theme stylesheets target, but nothing marks them as stable. A rename breaks
  third-party themes without failing any check.
- `LINK_STYLE` accepts a fixed set of names drawn inside the path renderer.
  The snapping animation when a link is released near a slot is drawn by
  separate code, so it ignores the style.

ADR-THEME-DOMAIN-0055 already treats the palette file format and the legacy
`colorPalette` API as extension contracts. This decision extends that contract;
it does not replace it.

## Decision

Add four extension points. Core's own non-solid themes use the same points, so
the API is proven by its first consumer.

1. **Provided themes.** `ComfyExtension` gains `themes?: ThemePreset[]`. Each
   preset is validated with `themePresetSchema` and listed in the palette
   picker with the extension as its source. Provided themes are held in memory,
   never written to `Comfy.CustomColorPalettes`, and exist only while their
   extension is loaded. A selected palette whose extension is gone falls back
   to the default, as a missing custom palette does today. An id that collides
   with a built-in or user palette is rejected with one console warning.
2. **Stylesheet by URL.** A preset's `stylesheet` may be the existing id or
   `{ id, url }`. While that theme is active, core imports the URL into the
   `presets` cascade layer and removes it when the theme changes. `data-theme`
   is set only after the stylesheet has loaded, so switching themes does not
   flash unstyled nodes.
3. **Public style hooks.** The `data-part` names and the state attributes above
   are a documented, versioned contract. A test lists them and fails when one
   disappears or changes meaning. Removing a hook follows the same deprecation
   path as removing a palette key.
4. **Link style registry.** `ComfyExtension` gains
   `linkStyles?: Record<string, LinkStyle>`. A `LinkStyle` supplies the stroke
   for a link colour, as a colour or a `CanvasPattern`, and says whether the
   dark border is drawn and how much to scale the width. `LINK_STYLE` becomes an
   open string looked up in the registry; an unknown name draws solid links.
   Core registers chalk through the registry. The snapping link moves onto the
   path renderer first so a registered style covers every link.

Deliver in that order: provided themes and stylesheet URLs together, then the
hook contract, then the link registry.

## Alternatives considered

- Keep `addCustomColorPalette` as the only route. It persists third-party
  presets into user data, errors on every reload after the first, and outlives
  the extension.
- Let extensions inject their own CSS. Unlayered CSS beats Tailwind utilities
  and every other layer, so an extension theme would behave differently from a
  built-in one and could break component states such as error rings.
- Give each extension its own cascade layer. Layer order would then depend on
  extension load order, and two extension themes could never be compared
  against the same baseline as built-in ones. Only one theme is active at a
  time, so the existing `presets` layer is enough.
- Expose classes instead of data attributes. Classes share a namespace with
  Tailwind utilities and change whenever a component's styling changes; data
  attributes describe structure and state, which change far less often.
- Let a link style replace the whole draw call. Core builds the path and uses
  it for hit testing, centre markers and the layout store. Handing that to an
  extension would let a style break link selection. A stroke-only hook keeps
  geometry in core.
- Keep `LINK_STYLE` closed and add more built-in styles. Every new look would
  then need a core release, which is the problem this decision removes.

## Consequences

The listed hooks become API: renaming a `data-part` or changing what a state
attribute means is a breaking change for extensions, and the guard test makes
that visible in review.

A theme switch can now wait on a network request. Stylesheets come from the
extension's own static files, so this costs one request the first time a theme
is selected.

A link style's stroke runs for every visible link on every frame, so core
caches it per colour and style, as the built-in chalk grain is cached today.
Extensions already run arbitrary JavaScript, so loading their CSS and calling
their stroke functions adds no new trust.

The extension contract gains an end-to-end check: an example theme in
ComfyUI_devtools uses all four points, and a core Playwright spec selects it.
