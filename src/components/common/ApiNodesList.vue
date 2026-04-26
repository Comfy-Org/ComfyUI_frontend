<!--
  Sizes to content by default. The row list shrinks and scrolls only when a
  parent caps total height below content size (e.g. popover with `max-h-144`,
  dialog wrapper with `max-h-144`). Callers are not required to supply
  `h-full` or a grow pattern.
-->
<template>
  <div class="flex min-h-0 flex-col gap-3">
    <div class="flex items-center justify-between text-xs opacity-70">
      <component :is="`h${headingLevel}`" :id="titleId">
        {{ t('apiNodesCostBreakdown.title') }} ({{ nodes.length }})
      </component>
      <div v-if="hasAnyCost">
        {{ t('apiNodesCostBreakdown.costPerRun') }}
      </div>
    </div>
    <!--
      Named via aria-labelledby pointing at the header above so screen
      readers announce "API Nodes — list" instead of an anonymous list.
      No tabindex: the list is content, and the enclosing dialog or
      popover already owns focus. A keyboard scroll stop is not worth
      the extra tab stop on every visit.
    -->
    <ul
      :aria-labelledby="titleId"
      class="m-0 flex min-h-0 flex-col gap-2 overflow-y-auto pl-0"
    >
      <li
        v-for="item in nodes"
        :key="item.id"
        data-testid="api-node-row"
        class="flex items-center justify-between gap-3 rounded-md bg-(--p-content-border-color) px-3 py-2"
      >
        <span class="text-base/tight font-medium">{{ item.name }}</span>
        <span
          v-if="item.cost"
          :aria-label="
            t('apiNodesCostBreakdown.costPerRunAria', { cost: item.cost })
          "
          class="text-sm/tight tabular-nums opacity-70"
        >
          {{ item.cost }}
        </span>
      </li>
    </ul>
    <div
      v-if="total"
      data-testid="api-nodes-total-cost"
      class="flex items-center justify-between border-t border-surface pt-3 text-sm"
    >
      <span>{{ t('apiNodesCostBreakdown.totalCost') }}</span>
      <span class="font-medium tabular-nums">{{ total.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const {
  nodes,
  total = null,
  headingLevel = 3
} = defineProps<{
  nodes: { id: string | number; name: string; cost: string | null }[]
  // Only `label` is rendered; callers may pass richer objects (the
  // aggregator's `formatAggregateTotal` result carries a `hasRange` flag)
  // and TypeScript's structural typing lets them through. Narrowing the
  // prop here keeps the component's contract to what it actually uses.
  total?: { label: string } | null
  // The list renders its title as a heading. Default `3` fits the
  // sign-in dialog where an `<h2>` wraps this list. Surfaces without an
  // outer heading (the actionbar popover) should pass `2` so the
  // document hierarchy doesn't skip from the dialog landmark straight
  // to `<h3>`.
  headingLevel?: 2 | 3 | 4 | 5 | 6
}>()

const hasAnyCost = computed(() => nodes.some((item) => item.cost !== null))

// Stable auto-generated id so two ApiNodesList instances on the page
// (possible during app transitions) do not collide on the shared title id.
const titleId = useId()

// Expose so a parent landmark (e.g. the popover's role="dialog") can name
// itself via `aria-labelledby="titleId"`. Without this hand-off the
// dialog has no accessible name and screen-reader landmark navigation
// announces it as anonymous.
defineExpose({ titleId })
</script>
