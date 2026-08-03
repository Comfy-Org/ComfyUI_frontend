# Tab-like Controls: Three Coexisting Patterns

This codebase has **three separate, non-interchangeable implementations** for "a row of options where one is selected," used in different contexts. Picking the right one matters — mixing them up is the single easiest way to make a new screen feel inconsistent with the surrounding app.

| Control (real example)                                              | Component                                                                                                                                                                       | Selected-state look                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Assets panel "Generated / Imported"                                 | `src/components/tab/Tab.vue` + `TabList.vue` (see `components/tab.md`)                                                                                                          | filled pill, `bg-interface-menu-component-surface-hovered`     |
| Workflow Overview panel "Parameters / Nodes / Global Settings"      | same `Tab`/`TabList`                                                                                                                                                            | same as above                                                  |
| Job Queue "All / Completed / Failed"                                | `src/components/queue/job/JobFilterTabs.vue` — a manual `v-for` loop of `ui/button/Button.vue`, `variant="secondary"` on the active one, `variant="muted-textonly"` on the rest | secondary-button fill vs. text-only                            |
| A generic segmented exclusive/multi choice (alignment picker, etc.) | `ui/toggle-group/ToggleGroup.vue` + `ToggleGroupItem.vue` (see `components/toggle-group.md`)                                                                                    | `data-[state=on]:bg-interface-menu-component-surface-selected` |

## Do

- Use `Tab`/`TabList` for an actual tab-switcher that swaps panel content — this is the dominant real-world pattern (Assets panel, Workflow Overview panel).
- Follow `JobFilterTabs`'s `Button`-loop pattern only if you're building another filter row that looks and behaves like the Job Queue's (few options, inline with a toolbar, not swapping full panel content).
- Reach for `ToggleGroup` when the control isn't really "tabs" — e.g. a boolean/enum setting rendered as a segmented control (text alignment, size picker), especially inside a form or a node widget.

## Don't

- Don't assume these three are interchangeable or that fixing one "fixes" the others — they have different markup, different ARIA roles (`Tab`/`TabList` is a real `role="tablist"`/`role="tab"` pair with roving focus; `ToggleGroup` uses Reka's `radiogroup`-like semantics; `JobFilterTabs` is just buttons), and different selected-state styling.
- Don't invent a fourth pattern. If none of the three fits, that's worth flagging rather than quietly adding another variant.
