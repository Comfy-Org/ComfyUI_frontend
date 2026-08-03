# AccessibleTooltip

**Path:** `src/components/ui/tooltip/AccessibleTooltip.vue`
**Built on:** Reka UI `TooltipProvider`/`TooltipRoot`/`TooltipTrigger`/`TooltipContent`/`TooltipArrow` (all composed inside a single component, unlike the multi-file Dialog/Popover pattern)

## Purpose

An accessibility-focused disclosure tooltip: reveals a label on hover, keyboard focus, **and** tap/click — not hover-only. This is the tooltip to use everywhere in this codebase.

## Props

| Prop           | Type                                     | Default                                |
| -------------- | ---------------------------------------- | -------------------------------------- |
| `label`        | `string \| string[]` (required)          | — (array joined with `', '`)           |
| `testId`       | `string`                                 | — sets `data-testid` on the trigger    |
| `triggerClass` | `string`                                 | —                                      |
| `ringClass`    | `string`                                 | `'focus-visible:ring-base-foreground'` |
| `side`         | `'top' \| 'right' \| 'bottom' \| 'left'` | `'top'`                                |
| `sideOffset`   | `number`                                 | `6`                                    |

## Slots

Default — trigger content. `#content` — overrides tooltip body (default renders the joined `label`).

## Usage

```vue
<script setup lang="ts">
import AccessibleTooltip from '@/components/ui/tooltip/AccessibleTooltip.vue'
</script>

<template>
  <AccessibleTooltip :label="['Kling', 'Luma']">
    <span>+2</span>
  </AccessibleTooltip>
</template>
```

## Do

- Always use this component for tooltips, not a hand-rolled `title` attribute or a hover-only Reka assembly — it correctly exposes the label as the accessible **name** (not description) and supports keyboard/touch disclosure.

## Don't

- Don't nest interactive elements that need their own click handling inside the default slot without `.stop` consideration — the trigger's own click is already `@click.stop`.

## Notes

Renders above open dialogs via `useModalLiftedZIndex`. `disable-closing-trigger` prevents re-clicking the trigger from closing an already-open (click-opened) tooltip.
