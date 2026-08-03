# Popover

There are **two independent popover implementations** in this codebase — pick deliberately.

## `ui/popover/{Popover,PopoverContent}.vue` — generic low-level wrapper

**Built on:** Reka UI `PopoverRoot` / `PopoverContent` (consumers import `PopoverTrigger`, `PopoverPortal`, `PopoverArrow` directly from `reka-ui` as needed).

| Component        | Props                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Popover`        | `PopoverRootProps` (`open?`, `defaultOpen?`, `modal?`); `v-model:open`                                                                                                 |
| `PopoverContent` | `PopoverContentProps & { class? }` — `align` default `'center'`, `sideOffset` default `4`; forwards `side`, `alignOffset`, `avoidCollisions`, `collisionPadding`, etc. |

```vue
<script setup lang="ts">
import { PopoverTrigger, PopoverPortal } from 'reka-ui'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import Button from '@/components/ui/button/Button.vue'
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button>Open</Button>
    </PopoverTrigger>
    <PopoverContent side="bottom" align="start">
      <p>Popover content</p>
    </PopoverContent>
  </Popover>
</template>
```

Use this for a custom popover body (forms, pickers) where you need full control of the content.

## `ui/Popover.vue` — ready-made ellipsis-menu popover

**Not related to the folder above** — it imports Reka UI primitives directly and is a complete, higher-level "kebab menu" component: trigger button (default icon `icon-[lucide--ellipsis]`) that opens a small popover rendering a list of `MenuItem` entries or custom slot content.

| Prop        | Type                                    | Default                     |
| ----------- | --------------------------------------- | --------------------------- |
| `entries`   | `MenuItem[]` (from `primevue/menuitem`) | `[]`                        |
| `icon`      | `string`                                | `'icon-[lucide--ellipsis]'` |
| `to`        | `string \| HTMLElement`                 | — (portal target)           |
| `showArrow` | `boolean`                               | `true`                      |

Slots: `#button` (override trigger), default (scoped `{ close }`, overrides menu body — default renders `entries`).

```vue
<script setup lang="ts">
import Popover from '@/components/ui/Popover.vue'
import type { MenuItem } from 'primevue/menuitem'

const entries: MenuItem[] = [
  { label: 'Rename', icon: 'icon-[lucide--pencil]', command: () => {} },
  { separator: true },
  { label: 'Delete', icon: 'icon-[lucide--trash]', command: () => {} }
]
</script>

<template>
  <Popover :entries="entries" />
</template>
```

## Do

- Use `ui/Popover.vue` for an ellipsis/kebab action menu — you get z-index-lifting above open dialogs and the arrow/menu-item styling for free.
- Use `ui/popover/*` when the popover body is not a simple menu list (forms, color pickers, custom widgets).

## Don't

- Don't import both expecting one to build on the other — they are unrelated implementations at different abstraction levels.
