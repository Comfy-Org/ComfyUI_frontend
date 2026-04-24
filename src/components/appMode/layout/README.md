# App Mode layout

Components for App Mode's layout system — a full-viewport output canvas with floating panels snapped to a grid.

## Before editing anything in this folder

**Read [`packages/design-system/src/css/layout.css`](../../../../packages/design-system/src/css/layout.css) first.** It's the single source of truth for layout visual constants — grid dimensions, type scale, radii, motion — expressed as Tailwind v4 `@theme` entries so each token generates a utility class. Prefer those utilities (`h-layout-cell`, `text-layout-xl`, `rounded-layout-cell`, `duration-layout`, `ease-layout`) over ad-hoc values.

Alias-layer colors live as design-system semantic tokens (`bg-base-background`, `bg-secondary-background`, `text-base-foreground`, `text-muted-foreground`). Layout-specific derived colors (`--color-layout-header-fill`, `--color-layout-grid-dot`) are defined on `:root` in the same file.

The type scale is deliberately tight: **4 sizes only** (`layout-md` / `layout-lg` / `layout-xl` / `layout-hero`). Resist adding a fifth.

## Structure

- `AppChrome.vue` — shared chrome rail (mode toggle, run cluster, share, action cells, history thumbs, feedback). Three fixed-gutter flex zones pinned to the top-left, top-right, and bottom-left corners. Each cell's width composes from the same tokens `FloatingPanel` uses (`span × cell + (span−1) × gutter`), so chrome + panel snap to identical pixel positions at every viewport. Consumed by both App Mode runtime and App Builder via a `variant` prop.
- `LayoutView.vue` — App Mode runtime view. Mounts `LinearPreview` as the full-viewport background layer, `AppChrome` above it, and one or more floating panels on top.
- `cells/` — individual cell components. Each fills its assigned chrome cell and renders one coherent piece of UI.
- `panels/` — floating-panel shell + snap-drag + drag-to-reorder block list. `--panel-dock-width` is derived from the same cell + gutter tokens the chrome uses.
- Tokens are loaded globally via `@comfyorg/design-system/css/style.css` (imported once at the app entry), so no per-view CSS import is needed.

## Cell conventions

- Cell roots fill their assigned box: `size-full` (or absolute fill if the cell is a positioning context).
- Visible cell background + hairline border + radius are applied by `AppChrome` (via its `cellClass()` helper) on the per-cell wrapper — individual cell components don't set their own outer background.
- Text at `text-layout-md` unless there's a concrete reason otherwise.
- Padding uses the token-implied rhythm (multiples of `gap-layout-gutter`).
- No decorative chrome: no shadows, no gradients, no rounded corners larger than `rounded-layout-cell`. Accent / primary color is owned by the shared `Button` primitive, not cells.

## Status

- **Landed:** grid substrate, per-input / per-output cells, design tokens, floating-panel shell, drag-to-snap between presets, drag-to-reorder block list, multi-column blocks within a panel.
- **Next:** schema + persistence, edit-mode lock, deeper builder integration.
- **Backlog:** multi-panel, output-as-panel, mobile, additional block types.
