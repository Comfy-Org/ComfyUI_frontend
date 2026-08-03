# Input

**Path:** `src/components/ui/input/Input.vue`
**Built on:** plain native `<input>` (not Reka UI)

## Purpose

Styled single-line text/number entry field.

## Props

| Prop    | Type                      | Default | Notes             |
| ------- | ------------------------- | ------- | ----------------- |
| `class` | `HTMLAttributes['class']` | —       | merge with `cn()` |

All other native attributes (`type`, `placeholder`, `disabled`, `maxlength`, etc.) fall through automatically.

No variants. Static classes: `flex h-10 w-full min-w-0 appearance-none rounded-lg border-none bg-secondary-background px-4 py-2 text-sm text-base-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50`.

## Events / v-model

`defineModel<string | number>()` — plain `v-model`.

## Exposed methods

`focus()`, `select()`, `blur()`, `setSelectionRange(start, end)`, `selectAll()` — call via a template ref for imperative control.

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue'
import Input from '@/components/ui/input/Input.vue'

const text = ref('')
</script>

<template>
  <Input v-model="text" placeholder="Enter text..." />
</template>
```

## Do

- Wrap in a `<label>` or pair with a `<label>` element for accessibility; `Input` has no built-in label slot.
- Use native attributes (`type="number"`, `type="email"`, `disabled`) directly — they pass through.

## Don't

- Don't reach for `Input` for multi-line text — use `Textarea`.
- Don't build a custom formatted-number input from scratch — see `FormattedNumberStepper` (stepper.md) for grouped/clamped numeric entry.

## Notes

No dedicated `.test.ts` file exists for `Input`.
