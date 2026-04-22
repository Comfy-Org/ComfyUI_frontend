# App Mode layout

Components for App Mode's layout system — a full-viewport output canvas with floating panels snapped to a grid. Related context and design docs live in [`comfyui-app-mode`](https://github.com/eliheuer/comfyui-app-mode) (private).

## Before editing anything in this folder

**Read [`packages/design-system/src/css/layout.css`](../../../../packages/design-system/src/css/layout.css) first.** It's the single source of truth for layout visual constants — grid dimensions, type scale, radii, motion — expressed as Tailwind v4 `@theme` entries so each token generates a utility class. Prefer those utilities (`h-layout-cell`, `text-layout-xl`, `rounded-layout-cell`, `duration-layout`, `ease-layout`) over ad-hoc values.

Alias-layer colors live as design-system semantic tokens (`bg-base-background`, `bg-secondary-background`, `text-base-foreground`, `text-muted-foreground`). Layout-specific derived colors (`--color-layout-header-fill`, `--color-layout-grid-dot`) are defined on `:root` in the same file.

The type scale is deliberately tight: **4 sizes only** (`layout-md` / `layout-lg` / `layout-xl` / `layout-hero`). Resist adding a fifth.

## Structure

- `LayoutGrid.vue` — grid primitive. Measures its container and computes explicit track counts at `cellSize` with `minGap` floor; slack is absorbed into `column-gap` / `row-gap` so the outer margin stays uniform on every edge. Serves as the **snap target** for floating panels.
- `LayoutView.vue` — runtime view. Mounts `LinearPreview` as the full-viewport background layer, the grid above it, and one or more floating panels on top.
- `cells/` — individual cell components. Each cell fills its assigned grid area and renders one coherent piece of UI.
- `panels/` — floating-panel shell + snap-drag + Notion-style block list.
- Tokens are loaded globally via `@comfyorg/design-system/css/style.css` (imported once at the app entry), so no per-view CSS import is needed.

## Cell conventions

- Cell roots fill their grid area: `size-full` (or absolute fill if the cell is a positioning context).
- Visible cell background is applied by `LayoutGrid` via the `.layout-cell:has(> *)` selector — individual cells don't set their own outer background.
- Text at `text-layout-md` unless there's a concrete reason otherwise.
- Padding uses the token-implied rhythm (multiples of `gap-layout-gutter`).
- No decorative chrome: no shadows, no gradients, no rounded corners larger than `rounded-layout-cell`. Accent / primary color is owned by the shared `Button` primitive, not cells.

## Phase map

Tracked in detail in the context repo's `todo.md` (Solution 04 — Semi-Customizable Floating Panels). Brief:

- **Phase 1–2 (done):** grid substrate + per-input / per-output cells + design tokens.
- **Phase 4-A / 4-C / 4-E / 4-F (done):** floating-panel shell, drag-to-snap between presets, Notion-style block reorder, multi-column blocks within a panel.
- **Phase 4-I (in progress):** UI/UX polish for draft PR.
- **Phase 4-B / 4-G / 4-H (next):** schema + persistence, edit-mode lock, builder integration.
- **Phase 5+ (backlog):** multi-panel, output-as-panel, mobile, additional block types.
