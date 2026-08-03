# Empty States

## Page/panel-level empty state

Use the shared `src/components/common/NoResultsPlaceholder.vue` component (wraps a PrimeVue `Card`). Structure: icon (optional) → title (optional `<h3>`) → message (required `<p>`) → optional action button.

```vue
<NoResultsPlaceholder
  icon="pi pi-info-circle"
  :title="$t('manager.emptyState.noResults.title')"
  :message="$t('manager.emptyState.noResults.message')"
  button-label="Clear filters"
  button-variant="textonly"
  @action="clearFilters"
/>
```

- Used across the app: settings panel, workflow/apps/assets sidebar tabs, error dialog content, extension manager dialog, node library panel.
- Copy is always sourced from i18n (`manager.emptyState.<key>.title`/`.message`, `sideToolbar.noImportedFiles`, etc.), not inline strings.
- `icon` is a PrimeIcons class (`pi pi-...`) in existing usage, not an Iconify `icon-[lucide--...]` class — match the surrounding convention in the file you're editing.
- The action button is optional; omit `button-label` entirely when there's no recovery action (e.g. "no results for your filter" with no clear action).

## Inline "no matches" state (inside a dropdown/combobox)

For a search/combobox with zero matches (not a full-page empty state), just render plain text — no icon, no card, no action button. See `MultiSelect`'s internal `ComboboxEmpty`: `{{ $t('g.noResultsFound') }}`, styled via `selectEmptyMessageClass` from `ui/select/select.variants.ts`.

## Do

- Reuse `NoResultsPlaceholder` for any page/panel/dialog-level "nothing here" state — don't build a bespoke one.
- Keep the inline dropdown "no matches" state to plain text, matching `g.noResultsFound`.

## Don't

- Don't invent a new empty-state component — one already exists and is used in 8+ places.
- Don't add an icon or action button to the inline dropdown empty state — that pattern is intentionally minimal.
