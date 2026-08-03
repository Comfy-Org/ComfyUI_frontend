# SingleSelect

**Path:** `src/components/ui/single-select/SingleSelect.vue`
**Built on:** Reka UI `SelectRoot` family (used directly, not via the low-level `ui/select/*` wrappers)

## Purpose

Opinionated, ready-to-use single-value dropdown select. **This is the component to reach for** — do not hand-assemble `ui/select/*` primitives unless you're building a genuinely new select variant.

## Props

| Prop              | Type             | Default   | Notes                                                         |
| ----------------- | ---------------- | --------- | ------------------------------------------------------------- |
| `label`           | `string`         | —         | trigger placeholder text; also `aria-label` fallback          |
| `options`         | `SelectOption[]` | —         | `{ name: string; value: string }` (from `ui/select/types.ts`) |
| `size`            | `'lg' \| 'md'`   | `'lg'`    | `lg` = 40px (Interface context), `md` = 32px (Node context)   |
| `invalid`         | `boolean`        | `false`   | shows destructive border                                      |
| `loading`         | `boolean`        | `false`   | shows spinner instead of `#icon` slot; sets `aria-busy`       |
| `disabled`        | `boolean`        | `false`   |                                                               |
| `listMaxHeight`   | `string`         | `'28rem'` |                                                               |
| `popoverMinWidth` | `string`         | —         |                                                               |
| `popoverMaxWidth` | `string`         | —         |                                                               |
| `contentStyle`    | `StyleValue`     | —         |                                                               |

## Slots

`#icon` — leading icon in the trigger (hidden while `loading`).

## Events / v-model

`defineModel<string | undefined>({ required: true })` — bound to the selected option's `value`.

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue'
import SingleSelect from '@/components/ui/single-select/SingleSelect.vue'

const selected = ref<string | undefined>()
const options = [
  { name: 'Popular', value: 'popular' },
  { name: 'Newest', value: 'newest' }
]
</script>

<template>
  <SingleSelect v-model="selected" :options="options" label="Category">
    <template #icon>
      <i class="icon-[lucide--arrow-up-down] size-3.5" />
    </template>
  </SingleSelect>
</template>
```

## Do

- Use `size="md"` inside node/canvas-context UI, `size="lg"` in interface panels/dialogs (matches the 32px/40px Figma spec).
- Set `invalid` to surface a validation error instead of a custom red border.

## Don't

- Don't assemble `Select`/`SelectTrigger`/`SelectContent`/`SelectItem` from `ui/select/*` directly for a normal dropdown — `SingleSelect` already does this and handles z-index-above-dialog, Escape-key scoping, and Safari portal quirks for you.

## Notes

If placed inside a `Dialog` and targeting Safari, the underlying content may need `disablePortal` — see `ui/select/SelectContent.vue`'s inline comment (Safari has issues with click events on portaled content inside dialogs).
