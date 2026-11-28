# ADR-THEME-EXTENSIONS-0061: Extensions provide themes through four extension points

Date: 2026-11-22

## Status

Proposed

## Context

A built-in theme can now change far more than colours. A palette names a theme
stylesheet that restyles Vue nodes through data-attribute hooks, and a
`LINK_STYLE` palette key draws links in a non-solid style such as chalk. All of
this works only for themes compiled into core.

An extension cannot ship a theme of the same kind, for four reasons:

- `app.extensionManager.colorPalette.addCustomColorPalette` saves the preset
  into the user's `Comfy.CustomColorPalettes`. The next page load reports that
  the id already exists, and uninstalling the extension leaves the palette
  behind. No API provides a palette without saving it.
- A preset's `stylesheet` is an id that becomes `data-theme` on the document,
  and core imports the CSS behind it at build time. An extension can already
  inject `<style>@layer presets { … }</style>`, because same-named cascade
  layers merge. Nothing loads that CSS only while its theme is active, removes
  it on a switch, or waits for it before setting `data-theme`.
- Theme stylesheets target the `data-part` names and the `data-theme`,
  `data-mode`, `data-error`, `data-executing`, `data-collapsed` and
  `data-node-type` attributes, but nothing marks them as stable. A rename
  breaks third-party themes without failing any check.
- `LINK_STYLE` accepts a fixed set of names, and the path renderer draws them.
  Separate code draws the snapping animation shown when a link is released
  near a slot, so that animation ignores the style.

ADR-THEME-DOMAIN-0055 already treats the palette file format and the legacy
`colorPalette` API as extension contracts. This decision extends that contract.

## Decision

Add four extension points. Core's own non-solid themes use the same points, so
core is the first consumer of the API.

1. **Provided themes.** `ComfyExtension` gains
   `themes?: { preset: ThemePreset; stylesheetUrl?: string }[]`. Core
   validates each preset with `themePresetSchema` and lists it in the palette
   picker with the extension as its source. Core holds provided themes in
   memory and never writes them to `Comfy.CustomColorPalettes`, so a provided
   theme exists only while its extension is loaded.

   Core cannot tell whether a stored id belongs to an extension that registers
   later, to an uninstalled extension, or to a deleted custom palette. For any
   unknown stored id, core keeps `Comfy.ColorPalette`, renders the default
   without showing an error, and applies the stored theme if a preset with
   that id appears. This also replaces today's write-back in
   `loadCustomThemePresets` for custom palettes. That write-back resets the
   setting to the default, which would erase the selection whenever an
   extension registers after startup, as late custom nodes do
   (ADR-EXTENSION-LOADING-0048), or fails to load once.

   Core rejects a provided id that matches a built-in palette. When two
   extensions provide the same id, the first registration wins. Each
   rejection logs one console warning. An extension claims all of its ids at
   once, before core waits on any stylesheet, so a slow load cannot hand a
   later id to another extension.

   A provided theme hides a saved user palette with the same id while its
   extension is loaded. Core keeps the saved copy in
   `Comfy.CustomColorPalettes`, refuses to delete it while it is hidden, and
   lists it again once the extension is gone. This is the migration path for
   an extension that saved its theme with `addCustomColorPalette`: it moves to
   `themes` with the same id, and the user's selection keeps working. When
   the stored selection names a theme an extension provides, core applies it
   on registration, even if the saved palette with that id is already active.

2. **Stylesheet by URL.** The URL sits beside the preset, in the
   `stylesheetUrl` of the extension's `themes` entry. The preset's
   `stylesheet` stays the id that becomes `data-theme`, so the palette format
   from ADR-THEME-DOMAIN-0055 does not change, and exporting a provided theme
   writes no URL. While that theme is active, core imports the URL into the
   `presets` cascade layer. Core removes it when the next theme commits, not
   when the switch starts.

   Core applies the theme only after the stylesheet loads, then commits tokens,
   canvas settings and `data-theme` together, so switching themes does not
   flash unstyled nodes. A newer switch cancels a pending load, so the latest
   selection wins. If the stylesheet fails to load, core applies the theme
   without it and logs one warning.

3. **Public style hooks.** The `data-part` names and the state attributes above
   are a documented, versioned contract for the node root and its parts. A
   test snapshots each hook name and the node part it sits on, and fails when
   one disappears or moves. The same attribute elsewhere, such as
   `data-collapsed` on the subgraph breadcrumb, is not part of the contract.
   Removing a hook follows the same deprecation path as removing a palette key.

4. **Link style registry.** `ComfyExtension` gains
   `linkStyles?: Record<string, LinkStyle>`. A `LinkStyle` takes the canvas
   context and a link colour and returns the stroke, either a colour or a
   `CanvasPattern` built from that context. It also says whether core draws
   the dark border and how much to scale the width.

   `LINK_STYLE` becomes an open string that core looks up in the registry, and
   an unknown name draws solid links. This is the one change this decision
   makes to the palette format from ADR-THEME-DOMAIN-0055: the key widens from
   a fixed set of names to any string, and every existing value stays valid.
   A frontend from before this change rejects a palette that names a
   registered style, so such a palette needs a current frontend.

   Core rejects a name that is already registered, core's `chalk` included,
   and logs one console warning. Core registers chalk through the registry.
   The snapping link moves onto the path renderer before the registry lands,
   so a registered style covers every link.

Deliver in that order: provided themes and stylesheet URLs together, then the
hook contract, then the link registry.

## Alternatives considered

- Keep `addCustomColorPalette` as the only route. It persists third-party
  presets into user data, errors on every reload after the first, and outlives
  the extension.
- Put the URL in the preset, with `stylesheet` taking `{ id, url }`. That
  changes the palette format from ADR-THEME-DOMAIN-0055, older frontends
  reject the new shape, and exporting the palette writes a URL that only
  resolves while that extension is installed.
- Reject a provided id that matches a saved user palette. An extension that
  saved its theme with `addCustomColorPalette` could then never move to
  `themes` without renaming it and losing the user's selection.
- Document `@layer presets` as the convention and let extensions inject their
  own CSS. The cascade would match built-in themes, but each extension would
  keep its CSS loaded for the whole session, and nodes would render with the
  new tokens before that CSS arrived. When core owns the load, every theme has
  the same lifecycle.
- Give each extension its own cascade layer. Layer order would then depend on
  extension load order, and two extension themes could never be compared
  against the same baseline as built-in ones. Only one theme is active at a
  time, so the existing `presets` layer is enough.
- Expose classes instead of data attributes. Classes share a namespace with
  Tailwind utilities and change whenever a component's styling changes. Data
  attributes describe structure and state, which change far less often.
- Let a link style replace the whole draw call. Core builds the path and uses
  it for hit testing, centre markers and the layout store. An extension that
  replaced the draw call could break link selection. A stroke-only hook keeps
  geometry in core.
- Keep `LINK_STYLE` closed and add more built-in styles. Every new look would
  then need a core release.

## Consequences

The listed hooks become API. Renaming a `data-part` or changing what a state
attribute means is a breaking change for extensions. The guard test catches a
renamed or moved hook, but a change in what a state attribute means still
relies on review. The hooks exist only when Vue nodes render. With
LiteGraph-rendered nodes, a theme stylesheet changes no nodes, while its tokens
and link style still apply.

A theme switch can now wait on a network request. Stylesheets come from the
extension's own static files, and while a URL theme is active, every page load
waits on that request before the theme applies.

A link style's stroke runs for every visible link on every frame, so core
caches it per colour and style, as it caches the built-in chalk grain today.
Extensions already run arbitrary JavaScript, so loading their CSS and calling
their stroke functions gives them no new capability.

The extension contract gains an end-to-end check: an example theme in
ComfyUI_devtools uses all four points, and a core Playwright spec selects it.
