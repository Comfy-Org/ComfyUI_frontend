# HoverCard

**Path:** `src/components/ui/hover-card/{HoverCard,HoverCardContent,HoverCardTrigger}.vue`, `hoverCardContext.ts`
**Built on:** Reka UI `HoverCardRoot` family

## Purpose

Hover-triggered floating content panel for supplementary info that shouldn't require a click. Automatically raises its z-index above any open modal dialog.

## Pieces

| Component          | Props                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `HoverCard`        | `HoverCardRootProps` (`defaultOpen?`, `open?`, `openDelay?`, `closeDelay?`); `v-model:open` |
| `HoverCardTrigger` | `HoverCardTriggerProps` (`as`/`asChild`)                                                    |
| `HoverCardContent` | `HoverCardContentProps & { class? }` — `side` default `'bottom'`, `sideOffset` default `8`  |

## Usage

```vue
<script setup lang="ts">
import HoverCard from '@/components/ui/hover-card/HoverCard.vue'
import HoverCardTrigger from '@/components/ui/hover-card/HoverCardTrigger.vue'
import HoverCardContent from '@/components/ui/hover-card/HoverCardContent.vue'
</script>

<template>
  <HoverCard :open-delay="200">
    <HoverCardTrigger as-child>
      <button>Hover me</button>
    </HoverCardTrigger>
    <HoverCardContent side="bottom" :side-offset="8">
      Extra info shown on hover.
    </HoverCardContent>
  </HoverCard>
</template>
```

## Do

- Use for supplementary, non-critical info (previews, extra metadata) — never put content here that's required to complete a task, since hover isn't available on touch.

## Don't

- Don't use `HoverCard` as a click-triggered menu — that's `ui/Popover.vue` or `ui/popover/*`.
