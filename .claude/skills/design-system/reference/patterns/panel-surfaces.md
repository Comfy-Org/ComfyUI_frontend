# Panel / Card Surfaces

There is **no shared `Card`/`Panel` primitive** under `ui/` (aside from PrimeVue's `Card`, used only inside `NoResultsPlaceholder`). The "card" look is a consistent, copy-pasted Tailwind class combination — reuse the combo below rather than inventing a new one.

## Compact list/row surface

```
rounded-lg border border-border-default p-4
```

Used for list rows with their own bounded surface (e.g. `SecretListItem.vue`).

## Large free-standing panel (dialog body, standalone section)

```
rounded-2xl border border-border-default bg-base-background
```

Used for bigger panels: dialog content wrappers, pricing tables, subscription panels. Inner padding is typically `p-6` for generously-spaced sections, `p-4` for denser ones.

## Popover surface

```
rounded-lg border border-border-default bg-base-background
```

plus a hard drop shadow (`shadow-interface` or an equivalent explicit shadow) rather than Tailwind's default `shadow-md`/`shadow-lg` — matches the floating-panel treatment used by `ui/Popover.vue` and `ui/dialog`'s content.

## Known inconsistency (don't "fix" silently, but don't propagate it either)

A few panels use `border-interface-stroke` instead of `border-border-default` for the same visual role (e.g. `SubscriptionPanelContentWorkspace.vue`). Treat `border-border-default` as the canonical token for new work — it's the one used in the overwhelming majority of surfaces — and don't copy `border-interface-stroke` into new prototypes.

## Do

- Use `rounded-lg border border-border-default p-4` for compact bounded rows, `rounded-2xl border border-border-default bg-base-background` for larger standalone panels.

## Don't

- Don't invent a third radius/border combo for a "card" — pick whichever of the two above matches the surface's size/prominence.
- Don't use `border-interface-stroke` for new panel borders — use `border-border-default`.
