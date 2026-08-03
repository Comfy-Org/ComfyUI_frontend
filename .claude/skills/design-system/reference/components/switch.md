# Switch

**Path:** `src/components/ui/switch/Switch.vue`
**Built on:** Reka UI `SwitchRoot` + `SwitchThumb`

## Purpose

Boolean on/off toggle, styled as an animated pill switch. Use for a setting the user flips immediately (no "submit" step) — not for a multi-option choice (use `ToggleGroup`) or a form checkbox requiring explicit submission.

## Props

| Prop       | Type                      | Default | Notes                                                            |
| ---------- | ------------------------- | ------- | ---------------------------------------------------------------- |
| `class`    | `HTMLAttributes['class']` | `''`    |                                                                  |
| `disabled` | `boolean`                 | `false` | fully non-interactive                                            |
| `readonly` | `boolean`                 | `false` | focusable/announced but not togglable — distinct from `disabled` |

`defineModel<boolean>({ default: false })`.

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue'
import Switch from '@/components/ui/switch/Switch.vue'

const checked = ref(false)
</script>

<template>
  <Switch v-model="checked" aria-label="Enable notifications" />
</template>
```

## Do

- Always set `aria-label` (or pair with a visible `<label>`) — `Switch` has no built-in label.
- Use `readonly` (not `disabled`) when a switch reflects a value the user can see and tab to but currently cannot change (e.g. gated by a plan tier) — it stays focusable and announced.

## Don't

- Don't use `Switch` for a value that requires a "Save" step — a switch implies the change takes effect immediately.

## Notes

`role="switch"` is set by Reka UI automatically.
