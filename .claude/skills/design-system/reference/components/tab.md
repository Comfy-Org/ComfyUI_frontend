# Tab / TabList

**Path:** `src/components/tab/Tab.vue`, `src/components/tab/TabList.vue`
**Built on:** plain native HTML (not Reka UI) — a standalone `provide`/`inject` implementation

## Purpose

The actual tab-switcher control used throughout the app shell — e.g. the "Generated / Imported" toggle in the Assets sidebar panel and the "Parameters / Nodes / Global Settings" tabs in the Workflow Overview panel. **This is not `ui/toggle-group`** — it's a separate, independent component family that happens to look similar. If you're building a tabbed view anywhere in this app, use `Tab`/`TabList`, not `ToggleGroup`.

## `TabList`

| Prop / Model | Type               | Notes                             |
| ------------ | ------------------ | --------------------------------- |
| `v-model`    | `T extends string` | required — the active tab's value |

Renders `<div role="tablist">` and provides tab-switching context to child `Tab`s via `provide`/`inject`.

## `Tab`

| Prop    | Type                          | Notes                                         |
| ------- | ----------------------------- | --------------------------------------------- |
| `value` | `T extends string` (required) | must match one of the values switched between |
| `class` | `HTMLAttributes['class']`     |                                               |

Renders `<button role="tab">` with full roving-focus keyboard support (Arrow keys/Home/End move focus between tabs, matching the ARIA tabs pattern). Active state: `bg-interface-menu-component-surface-hovered text-text-primary`. Inactive: `bg-transparent text-text-secondary` with hover/focus backgrounds.

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue'
import Tab from '@/components/tab/Tab.vue'
import TabList from '@/components/tab/TabList.vue'

const activeTab = ref<'output' | 'input'>('output')
</script>

<template>
  <TabList v-model="activeTab">
    <Tab value="output">Generated</Tab>
    <Tab value="input">Imported</Tab>
  </TabList>
</template>
```

## Do

- Use this for any segmented tab-switcher (2+ views sharing one panel), matching the real app's Assets and Workflow Overview panels.
- Pair each `Tab` with actual panel content shown/hidden based on the same `v-model` value — `TabList` only handles the switcher UI, not panel visibility.

## Don't

- Don't use `ui/toggle-group/ToggleGroup` for a tab-switcher — despite the visual similarity, the real app reserves `ToggleGroup` for other multi-option controls (e.g. the labeled two-option variant of a widget switch) and uses `Tab`/`TabList` specifically for tabs.
- Don't confuse this with the Job Queue's "All / Completed / Failed" filter row — that one is yet a _third_ pattern (`src/components/queue/job/JobFilterTabs.vue`, a manual loop of `ui/button/Button.vue` toggling `variant`), not `Tab`/`TabList` either. See `patterns/tab-like-controls.md`.
