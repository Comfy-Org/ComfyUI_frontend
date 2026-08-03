# Loading States

Two mechanisms, used at different granularities — pick based on what's loading.

## Per-action loading: `Button`'s `loading` prop

For an in-place async action (form submit, delete, a single row action): set `:loading="isBusy"` on the `Button`. It disables the button and swaps its content for a spinner automatically — no separate spinner element needed.

```vue
<Button
  variant="destructive"
  :loading="operatingId === row.id"
  @click="remove(row.id)"
>
  Delete
</Button>
```

Key an `isBusy` flag per-row-id (not one global flag) when multiple rows can each trigger their own async action independently — see `SecretsPanel.vue`'s `operatingSecretId === secret.id` pattern.

## List/grid/card content loading: `Skeleton`

For content that hasn't loaded yet (a list, a card grid), render `Skeleton` blocks shaped like the real content, not one generic placeholder:

```vue
<div v-if="isLoading" class="flex flex-col gap-2">
  <Skeleton class="h-4 w-3/4" />
  <Skeleton class="h-3 w-1/2" />
</div>
<template v-else>
  <!-- real content -->
</template>
```

For a repeated card grid, build a dedicated `*Skeleton.vue` component that mirrors the real card's structure (avatar circle, title bar, description lines, tag pills) and repeat it N times — see `PackCardSkeleton.vue` + `GridSkeleton.vue` for the reference shape.

## Do

- Use `Button`'s `loading` prop for single actions; use `Skeleton` for content-shaped placeholders.
- Build a purpose-shaped skeleton (mirroring the real card/row layout) rather than one undifferentiated block, when skeletons represent a repeated card/row.

## Don't

- Don't build a custom spinner overlay for a button action — `loading` already does this.
- Don't show a full-page spinner for a partial content region that has its own loading state — prefer a scoped `Skeleton`.
