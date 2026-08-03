# SidebarIcon

**Path:** `src/components/sidebar/SidebarIcon.vue`
**Built on:** `ui/button/Button.vue` (`variant="muted-textonly"`) + PrimeVue `v-tooltip`

## Purpose

The actual building block behind the app's left/right icon rails (Assets, Nodes, Models, Workflows, Apps, Templates, Help, Shortcuts, Settings). Composed into a rail by `src/components/sidebar/SideToolbar.vue`.

**Note:** there is a separate `LeftSidePanel`/`NavItem` component pair under `src/components/widget/panel/` and `src/components/widget/nav/` that looks like it should be "the" nav rail. It isn't used in the main app shell — it's only used inside modals (asset browser, template selector, extension manager). Use `SidebarIcon` + `SideToolbar` for the real app-shell rail; use `LeftSidePanel`/`NavItem` only if you're building a modal with its own internal nav rail.

## Props

| Prop            | Type                               | Default | Notes                                                  |
| --------------- | ---------------------------------- | ------- | ------------------------------------------------------ |
| `icon`          | `string \| Component`              | `''`    | Iconify class string or a Vue icon component           |
| `selected`      | `boolean`                          | `false` | active/current-tab state                               |
| `tooltip`       | `string`                           | `''`    | falls back to `label` if omitted                       |
| `tooltipSuffix` | `string`                           | `''`    | appended to the resolved tooltip text                  |
| `iconBadge`     | `string \| (() => string \| null)` | `''`    | small numeric/text badge overlaid on the icon          |
| `badgeClass`    | `string`                           | `''`    | positioning override for the badge (default top-right) |
| `label`         | `string`                           | `''`    | caption below the icon (hidden when `isSmall`)         |
| `isSmall`       | `boolean`                          | `false` | icon-only, no label                                    |

## Slots

`#icon` — override the default icon rendering entirely (badge included).

## Events

`click: [event: MouseEvent]`

## Usage

```vue
<script setup lang="ts">
import SidebarIcon from '@/components/sidebar/SidebarIcon.vue'

const activeTab = ref<'assets' | 'nodes'>('assets')
</script>

<template>
  <SidebarIcon
    icon="icon-[lucide--image]"
    label="Assets"
    :selected="activeTab === 'assets'"
    @click="activeTab = 'assets'"
  />
</template>
```

## Notes

- Sizing comes from CSS custom properties set by the surrounding rail (`--sidebar-width`, `--sidebar-item-height`, `--sidebar-icon-size`), not props — this component assumes it's placed inside `SideToolbar`'s rail context.
- Uses PrimeVue's `v-tooltip` directive rather than `ui/tooltip/AccessibleTooltip.vue`, and has scoped/unscoped `<style>` blocks rather than pure Tailwind utility classes — both deviate from current repo conventions (see AGENTS.md: avoid new PrimeVue usage, avoid `<style>` blocks). Treat this as legacy-but-in-use, not a pattern to copy into new components.
- Selected state renders a 4px accent border on the side facing the canvas (left border on the left rail, right border on the right rail), plus a highlighted background.
