# Textarea

**Path:** `src/components/ui/textarea/Textarea.vue`
**Built on:** plain native `<textarea>` (not Reka UI)

## Purpose

Styled multi-line text entry field.

## Props

| Prop    | Type                      | Default | Notes             |
| ------- | ------------------------- | ------- | ----------------- |
| `class` | `HTMLAttributes['class']` | —       | merge with `cn()` |

All other native attributes (`rows`, `placeholder`, `disabled`, etc.) fall through automatically.

No variants. Static classes: `flex min-h-16 w-full scrollbar-gutter-stable rounded-lg border-none bg-secondary-background px-3 py-2 text-sm text-base-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50`.

## Events / v-model

`defineModel<string | number>()` — plain `v-model`.

## Exposed methods

`focus()` via `defineExpose` (no `select`/`blur`, unlike `Input`).

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'

const value = ref('')
</script>

<template>
  <Textarea v-model="value" placeholder="Type something..." class="max-w-sm" />
</template>
```

## Do

- For a floating-label layout, wrap in a `relative` div and overlay a `<label>` above the textarea (see the `WithLabel` story pattern).

## Don't

- Don't use for single-line input — use `Input`.

## Notes

`class` prop merges with (does not replace) the internal classes — verified by `Textarea.test.ts`.
