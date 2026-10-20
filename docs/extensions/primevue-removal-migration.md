# PrimeVue Removal Migration Notes

ComfyUI frontend no longer installs PrimeVue. The host app does not call
`app.use(PrimeVue)`, so extensions lose three things they may have relied on:

- the `$primevue` global property on the host Vue app;
- the PrimeVue theme stylesheet, so PrimeVue components that an extension
  renders inside the host app render unstyled; and
- every global `--p-*` CSS variable, such as `--p-primary-color`,
  `--p-surface-*`, `--p-text-color`, `--p-content-background` and
  `--p-form-field-border-color`.

## Extensions that render PrimeVue components

Do not rely on the host app's PrimeVue instance. Either replace the PrimeVue
components with your own markup, or create your own Vue app for your UI and
install PrimeVue and its theme on that app.

## Extensions that read `--p-*` variables

Replace them with the design system theme variables, which follow the active
light or dark theme and the active color palette:

| PrimeVue variable                                         | Theme variable       |
| --------------------------------------------------------- | -------------------- |
| `--p-primary-color`                                       | `--primary`          |
| `--p-text-color`                                          | `--foreground`       |
| `--p-text-muted-color`                                    | `--muted-foreground` |
| `--p-content-background`                                  | `--background`       |
| `--p-surface-*` (panels, elevated areas)                  | `--secondary`        |
| `--p-content-border-color`, `--p-form-field-border-color` | `--border`           |

## Deprecated variable names

Earlier versions of these notes pointed at older design system names. They
still resolve, but they are deprecated and will be removed in a future
release. Move to the theme variable now:

| Deprecated name               | Theme variable |
| ----------------------------- | -------------- |
| `--base-background`           | `--background` |
| `--base-foreground`           | `--foreground` |
| `--border-default`            | `--border`     |
| `--primary-background`        | `--primary`    |
| `--secondary-background`      | `--secondary`  |
| `--component-node-background` | `--node`       |

PrimeIcons are still loaded, so `pi pi-*` icon classes keep working.
