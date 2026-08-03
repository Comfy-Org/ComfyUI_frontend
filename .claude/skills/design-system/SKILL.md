---
name: design-system
description: 'ComfyUI_frontend design system reference — design tokens, ui/ component APIs, and composition patterns extracted from the production Vue codebase. Use when assembling a UI prototype, mockup, or new feature screen that should look and behave on-brand, or when asked what component/token to use for a given piece of UI. Not for general Vue/TypeScript coding questions unrelated to visual design.'
---

# ComfyUI_frontend Design System

This skill lets an agent assemble on-brand prototypes from the same building blocks used in production — real `src/components/ui/*` Vue components and real Tailwind 4 design tokens — instead of improvising markup or hardcoded colors.

## How to use this skill

1. **Never hand-write raw styled markup for something a component already covers.** Check `reference/components/` first. If a component exists for the UI element you need (button, input, select, dialog, tooltip, toggle, table, etc.), import and use it exactly as documented — don't rebuild it with `<div>`s and Tailwind classes.
2. **Never hardcode a color, and never use the `dark:` Tailwind variant.** Look up the semantic token in `reference/tokens/tokens.json` and use its Tailwind class (e.g. `bg-secondary-background`, `text-muted-foreground`). Semantic tokens already resolve correctly in both themes via the `.dark-theme` class selector — that's what makes `dark:` unnecessary and forbidden here.
3. **For a common UI shape (a form, an empty state, a confirmation dialog, a loading placeholder, a toast, a card surface), read the matching file in `reference/patterns/` before composing components yourself.** These encode real layout/spacing/button-order conventions pulled from production code, not generic best practices.
4. **When composing multiple components, match the class merging and icon conventions below** — they're enforced by lint rules in the real codebase and a prototype that violates them will look subtly off-brand.
5. If Figma access is available (Figma MCP connector), prefer fetching the live **Comfy Design Standards** file for hover/click-target/affordance specs before implementing new interactive elements — see `docs/guidance/design-standards.md` in the main repo for file keys and node IDs. This skill's `reference/` content is the code-truth companion to that visual-spec source; use both together, and treat Figma as authoritative for anything not covered here.

## Live workspace (real components, tied to production code)

`reference/` is documentation; `src/stories/` is where you actually _build_. Everything under it is a Storybook story that renders the real, compiled `ui/*` components — not a static mockup — so behavior (focus, portals, ARIA, validation) is real too. Run `pnpm storybook` and use its left sidebar as the nav: it groups stories by their `title` path, so `Templates/*` and `Playground/*` each show up as their own browsable section — click one to open it, edit its `render()`, save, and it hot-reloads.

Two places to build, for two different purposes:

- **`src/stories/templates/*.stories.ts` (sidebar: Templates/…)** — a growing library of named, reusable screen compositions, meant to persist. Reference one to see a pattern applied, build on top of one by extending its `render()`, or copy the file as a starting point for something new. Shipped so far:

  | Template                                      | Composes                                             | Pattern doc                                                      |
  | --------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
  | `templates/CreateResourceDialog.stories.ts`   | Button, Dialog family, Input, SingleSelect, Switch   | `patterns/forms.md` (dialog-form shape)                          |
  | `templates/SettingsPanel.stories.ts`          | Switch, SingleSelect, FormattedNumberStepper, Button | `patterns/forms.md` (settings-row shape)                         |
  | `templates/ConfirmDeleteDialog.stories.ts`    | Dialog family, Button.loading                        | `patterns/confirmation-dialogs.md`, `patterns/loading-states.md` |
  | `templates/EmptyStateList.stories.ts`         | SearchInput, the real `NoResultsPlaceholder.vue`     | `patterns/empty-states.md`                                       |
  | `templates/DataListWithPagination.stories.ts` | SearchInput, Table family, Pagination                | — (composed from individually documented components)             |

  When asked to build a new template, add a new file here (one template per file, `title: 'Templates/<Name>'`) rather than growing an existing one into something it isn't — keep each template scoped to one screen shape.

- **`src/stories/Playground.stories.ts` (sidebar: Playground/Design System)** — a single blank canvas for one-off, throwaway prototyping. Overwrite its `render()` freely; it isn't meant to accumulate history. If what you build here turns out to be worth keeping, promote it into `templates/` as its own file rather than leaving it in Playground.

Either way: use `reference/` to decide _which_ components and pattern fit before writing template code, the same as you would for a one-off prototype.

## Reference index

### Tokens

- [tokens/tokens.json](reference/tokens/tokens.json) — colors (palette + semantic light/dark), typography, spacing, radii, shadows, z-index, iconography rules. Structured JSON, read directly.

### Components (`reference/components/`)

| Doc                                                               | Covers                                                                                        |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [button.md](reference/components/button.md)                       | `Button` — all click actions                                                                  |
| [button-group.md](reference/components/button-group.md)           | `ButtonGroup` — joined button rows                                                            |
| [input.md](reference/components/input.md)                         | `Input` — single-line text                                                                    |
| [textarea.md](reference/components/textarea.md)                   | `Textarea` — multi-line text                                                                  |
| [single-select.md](reference/components/single-select.md)         | `SingleSelect` — one-value dropdown (use this, not raw Select primitives)                     |
| [multi-select.md](reference/components/multi-select.md)           | `MultiSelect` — multi-value combobox                                                          |
| [select-primitives.md](reference/components/select-primitives.md) | `ui/select/*` low-level primitives — only for building a new select variant                   |
| [search-input.md](reference/components/search-input.md)           | `SearchInput` / `AsyncSearchInput` / `SearchAutocomplete`                                     |
| [tags-input.md](reference/components/tags-input.md)               | `TagsInput` — editable chip/tag list                                                          |
| [switch.md](reference/components/switch.md)                       | `Switch` — boolean toggle                                                                     |
| [slider.md](reference/components/slider.md)                       | `Slider` — numeric range slider                                                               |
| [stepper.md](reference/components/stepper.md)                     | `FormattedNumberStepper` — grouped numeric input with +/-                                     |
| [credit-slider.md](reference/components/credit-slider.md)         | `CreditSlider` — billing-domain example of a discrete-stop slider                             |
| [dialog.md](reference/components/dialog.md)                       | `Dialog` family — modals                                                                      |
| [popover.md](reference/components/popover.md)                     | `ui/popover/*` (generic) vs `ui/Popover.vue` (ready-made menu) — two distinct implementations |
| [hover-card.md](reference/components/hover-card.md)               | `HoverCard` — hover-triggered info panel                                                      |
| [tooltip.md](reference/components/tooltip.md)                     | `AccessibleTooltip` — the only tooltip to use                                                 |
| [table.md](reference/components/table.md)                         | `Table` family — presentational table primitives                                              |
| [pagination.md](reference/components/pagination.md)               | `Pagination`                                                                                  |
| [chart.md](reference/components/chart.md)                         | `ChartBar` / `ChartLine`                                                                      |
| [color-picker.md](reference/components/color-picker.md)           | `ColorPicker` — HSVA picker                                                                   |
| [skeleton.md](reference/components/skeleton.md)                   | `Skeleton` — loading placeholder                                                              |
| [toggle-group.md](reference/components/toggle-group.md)           | `ToggleGroup` — segmented exclusive/multi choice                                              |
| [zoom-pane.md](reference/components/zoom-pane.md)                 | `ZoomPane` — pan/zoom viewport                                                                |
| [tab.md](reference/components/tab.md)                             | `Tab` / `TabList` — the app's real tab-switcher (not `ui/`, not `ToggleGroup`)                |
| [batch-count-edit.md](reference/components/batch-count-edit.md)   | `BatchCountEdit` — the toolbar's run-count stepper (not `FormattedNumberStepper`)             |
| [sidebar-icon.md](reference/components/sidebar-icon.md)           | `SidebarIcon` — the app-shell's real icon-rail building block                                 |

### Patterns (`reference/patterns/`)

| Doc                                                                   | Covers                                                                                                            |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [forms.md](reference/patterns/forms.md)                               | Dialog-form vs. settings-row layouts, validation, footer button order                                             |
| [empty-states.md](reference/patterns/empty-states.md)                 | `NoResultsPlaceholder` and the inline dropdown "no matches" state                                                 |
| [confirmation-dialogs.md](reference/patterns/confirmation-dialogs.md) | Destructive-action dialog structure and button order                                                              |
| [loading-states.md](reference/patterns/loading-states.md)             | `Button.loading` vs. `Skeleton` — when to use which                                                               |
| [notifications.md](reference/patterns/notifications.md)               | Toast API: `useToast()` vs. `useToastStore()`                                                                     |
| [panel-surfaces.md](reference/patterns/panel-surfaces.md)             | The two recurring card/panel Tailwind class combos                                                                |
| [tab-like-controls.md](reference/patterns/tab-like-controls.md)       | Three coexisting "row of options" patterns (`Tab`/`TabList`, `JobFilterTabs`, `ToggleGroup`) and when to use each |

## Hard rules (violating these makes a prototype look off-brand or breaks lint)

- Never use the `dark:` Tailwind variant — use a semantic token instead.
- Never hardcode a hex color — map to a semantic token from `tokens.json`.
- Never merge classes with `:class="[]"` array syntax — use `cn()` from `@comfyorg/tailwind-utils`, e.g. `<div :class="cn('text-node-component-header-icon', hasError && 'text-danger')" />`.
- Never use `!important` / the `!` Tailwind prefix.
- Never use arbitrary percentage widths (`w-[80%]`) when a fraction utility exists (`w-4/5`).
- Never size an `icon-[...]`/`icon-mask-[...]` (Iconify) icon with a `text-*` font-size class — use `size-*`, or set font-size on the parent and let the icon's built-in `1.2em` scale.
- Icons come from two systems only: `icon-[lucide--<name>]` for general UI icons, `icon-[comfy--<name>]` / `icon-mask-[comfy--<name>]` for brand/provider/node glyphs. Don't inline raw SVG or use an icon font.

## Scope notes

- This skill is mainly `src/components/ui/*` — the shadcn-vue-on-Reka-UI primitive layer — plus a handful of app-shell components (`Tab`/`TabList`, `BatchCountEdit`, `SidebarIcon`) pulled in specifically because they're what the real running app actually uses in places a naive reading of `ui/*` alone would get wrong. It does not document PrimeVue components directly (`docs/guidance/engineering.md` in the main repo: avoid new usage of PrimeVue components — prefer `ui/*` or build a new `ui/*` component following the existing patterns).
- **`ui/*` is one of several coexisting UI systems in this codebase, not the only one.** Verified directly against a real app screenshot: `src/components/tab/*` (the actual tab-switcher — see `components/tab.md`), `src/components/queue/job/JobFilterTabs.vue` (a third tab-like pattern, see `patterns/tab-like-controls.md`), `src/components/sidebar/*` (the real icon-rail, see `components/sidebar-icon.md`), `src/components/actionbar/BatchCountEdit.vue` (a second, incompatible stepper — see `components/batch-count-edit.md`), `src/components/common/*` (e.g. `ScrubableNumberInput`, `StatusBadge`), and the node-widget layer under `src/renderer/extensions/vueNodes/widgets/*` (which reimplements some select/input patterns directly against `reka-ui` rather than importing the `ui/*` wrappers) all exist in parallel and are NOT documented here beyond the three call-outs above. Before assuming "the design system" covers a given piece of the real UI, check which component actually renders it — don't assume visual similarity means it's the `ui/*` component you'd expect.
- If a needed component doesn't exist in `reference/components/`, don't silently fall back to PrimeVue or raw markup — compose it from the lower-level primitives already documented (Reka UI wrappers), matching the conventions in `src/components/ui/AGENTS.md` (reactive props destructuring, `useForwardProps`/`useForwardPropsEmits`, `cn()`, direct sibling imports not barrel imports).
- Token and component data here reflects the state of the codebase as of this skill's creation. Before relying on an exact prop name or class string for a real code change (not just a prototype), verify against the live source file cited at the top of each doc — this skill can drift as the codebase evolves.
