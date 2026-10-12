# Tooltip Migration Notes

ComfyUI frontend no longer uses the PrimeVue tooltip. The global `v-tooltip`
directive is gone, and tooltips no longer render the PrimeVue DOM:

- `.p-tooltip` and `.p-tooltip-text`
- the `data-pd-tooltip` attribute
- the `$_ptooltip*` element properties

An open tooltip now renders one element with `data-slot="tooltip-content"`,
portaled to the end of `document.body`. It exists only while the tooltip is
open. Extensions that hide tooltips during their own UI should target
`[data-slot="tooltip-content"]` instead of `.p-tooltip`.

The `--node-component-tooltip*` CSS variables are also removed from the design
system stylesheet. Use the tooltip surface tokens instead:
`--base-background`, `--base-foreground` and `--border-default`.
