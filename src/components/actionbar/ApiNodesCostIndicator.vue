<template>
  <!--
    Gate on pricedNodeCount rather than the bare aggregate so workflows
    made up entirely of text-priced api-nodes (pricedNodeCount = 0,
    unpricedNodeCount > 0) don't surface a compact "0+" chip with no
    actionable cost information. The sign-in dialog still renders the
    breakdown for those workflows because the user asked for it there;
    the actionbar chip is a passive glance and silence is fine when
    there's no numeric cost to show.
  -->
  <PopoverRoot v-if="aggregate?.pricedNodeCount">
    <PopoverTrigger as-child>
      <Button
        variant="secondary"
        size="unset"
        class="h-8 gap-1.5 rounded-lg px-3 font-light"
        data-testid="api-nodes-cost-indicator"
        :aria-label="chipAriaLabel"
      >
        <i class="icon-[lucide--coins] size-4" />
        <span class="text-sm tabular-nums">{{ compactLabel }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverPortal>
      <!--
        No aria-label on PopoverContent — Reka gives it role="dialog"
        and the inner ApiNodesList already supplies the accessible name
        via aria-labelledby. Adding an aria-label here would shadow that
        name; the trigger button has its own aria-label for context
        before the popover opens.
      -->
      <!--
        max-height bounded by the lesser of a 36rem cap and Reka's
        collision-aware available height. On short viewports or high
        zoom levels, the popover would otherwise clip to the hardcoded
        cap and scroll off-screen; binding to the available-height CSS
        variable keeps the inner scroll area sized to what's actually on
        screen while preserving the 36rem ceiling.
      -->
      <PopoverContent
        side="top"
        :side-offset="8"
        :collision-padding="16"
        class="z-1400 flex max-h-[min(36rem,var(--reka-popover-content-available-height))] w-80 flex-col rounded-lg border border-border-subtle bg-base-background p-3 shadow-interface"
        data-testid="api-nodes-cost-popover"
      >
        <ApiNodesList :nodes="rows" :total="popoverTotal" :heading-level="2" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<script setup lang="ts">
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ApiNodesList from '@/components/common/ApiNodesList.vue'
import Button from '@/components/ui/button/Button.vue'
import { useApiNodeRows } from '@/composables/node/useApiNodeRows'
import {
  formatAggregateTotal,
  formatCompactCreditRange,
  useGraphCostAggregator
} from '@/composables/node/useGraphCostAggregator'
import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'

const { t } = useI18n()

// `graph` is threaded in from the actionbar — a getter so the composables
// below re-read it freshly via `toValue()` on every reactive invalidation.
// Taking the graph as a prop (rather than reaching into `app.rootGraph`
// here) keeps this component free of the global-singleton import, which
// matches the sign-in dialog surface that already accepts an explicit
// `graph` prop.
const { graph } = defineProps<{
  graph: () => LGraph | Subgraph | null
}>()

const aggregate = useGraphCostAggregator(graph)
const rows = useApiNodeRows(graph)

// Chip label drops the unit — visual weight comes from the coin icon —
// while the popover total follows the same "<value> credits" shape the
// sign-in dialog uses via the shared helper. The same range/suffix
// formatting backs both surfaces so a chip change cannot drift away
// from the dialog's total.
const compactLabel = computed(() =>
  aggregate.value ? formatCompactCreditRange(aggregate.value) : ''
)

const popoverTotal = computed(() => formatAggregateTotal(aggregate.value, t))

// Screen readers otherwise announce just the coin icon + a bare number
// (e.g. "~76.5-104.6"); this gives them the feature's purpose.
// Returning undefined rather than '' on the empty branch so Vue omits
// the attribute entirely — an empty aria-label tells screen readers to
// ignore the element, which is the opposite of what we want if the
// v-if guard is ever loosened in a future refactor.
const chipAriaLabel = computed<string | undefined>(() =>
  compactLabel.value
    ? t('apiNodesCostBreakdown.chipAriaLabel', { value: compactLabel.value })
    : undefined
)
</script>
