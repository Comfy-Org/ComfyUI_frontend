<script setup lang="ts">
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

import PartnerNodeItem from '@/renderer/extensions/linearMode/PartnerNodeItem.vue'
import type { NodeId } from '@/types/nodeId'

defineProps<{ badges: readonly (readonly [string, string, NodeId])[] }>()

const { t } = useI18n()
</script>
<template>
  <div
    class="flex flex-col gap-2.5 rounded-xl border border-border-default bg-secondary-background p-3 text-base-foreground shadow-interface"
  >
    <div class="flex items-center gap-1">
      <p
        class="m-0 text-xs/snug font-semibold"
        v-text="t('linearMode.hasCreditCost')"
      />
      <TooltipProvider :delay-duration="100">
        <TooltipRoot>
          <TooltipTrigger as-child>
            <i
              class="icon-[lucide--info] size-3.5 shrink-0 cursor-help text-muted-foreground"
            />
          </TooltipTrigger>
          <TooltipPortal>
            <TooltipContent
              side="top"
              :side-offset="4"
              :collision-padding="10"
              class="z-2000 max-w-64 rounded-md bg-base-foreground px-2 py-1.5 text-xs/snug text-base-background shadow-interface"
            >
              {{ t('linearMode.creditApproximateInfo') }}
            </TooltipContent>
          </TooltipPortal>
        </TooltipRoot>
      </TooltipProvider>
    </div>
    <ul
      :aria-label="t('linearMode.creditBreakdown')"
      class="m-0 grid max-h-31 list-none grid-cols-[1fr_auto] gap-x-3 gap-y-2 overflow-y-auto pr-0.5 pl-0"
    >
      <PartnerNodeItem
        v-for="[title, price, key] in badges"
        :key
        :title
        :price
      />
    </ul>
  </div>
</template>
