<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
  PopoverArrow,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import PartnerNodeItem from '@/renderer/extensions/linearMode/PartnerNodeItem.vue'
import { graphCreditsBadges } from '@/systems/badgeSystem'

defineProps<{ mobile?: boolean }>()

const { t } = useI18n()
const canvasStore = useCanvasStore()

const creditsBadges = computed(() => {
  const rootGraph = canvasStore.currentGraph?.rootGraph
  return rootGraph ? graphCreditsBadges(rootGraph) : []
})
</script>
<template>
  <PopoverRoot v-if="mobile && creditsBadges.length">
    <PopoverTrigger as-child>
      <Button class="mr-2 size-10">
        <i class="icon-[lucide--coins] bg-credit" />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      side="top"
      :side-offset="5"
      dismiss-on-viewport-change
      class="w-auto rounded-lg border-border/50 p-2 shadow-sm"
    >
      <section
        class="max-h-(--reka-popover-content-available-height) scroll-shadows-background overflow-y-auto"
      >
        <PartnerNodeItem
          v-for="{ nodeId, title, price } in creditsBadges"
          :key="nodeId"
          :title
          :price
        />
      </section>
      <PopoverArrow class="fill-background stroke-border/50" />
    </PopoverContent>
  </PopoverRoot>
  <div v-else-if="creditsBadges.length === 1">
    <PartnerNodeItem
      v-for="{ nodeId, title, price } in creditsBadges"
      :key="nodeId"
      :title
      :price
      class="border-t border-border/50 pt-2"
    />
  </div>
  <CollapsibleRoot
    v-else-if="creditsBadges.length"
    v-slot="{ open }"
    class="flex max-h-1/2 w-full flex-col"
  >
    <div class="mb-1 w-full border-b border-border/50" />
    <CollapsibleTrigger as-child>
      <Button variant="textonly" class="w-full text-sm">
        <i class="icon-[lucide--coins] bg-credit" />
        {{ t('linearMode.hasCreditCost') }}
        <i v-if="open" class="ml-auto icon-[lucide--chevron-up]" />
        <i v-else class="ml-auto icon-[lucide--chevron-down]" />
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent class="scroll-shadows-background overflow-y-auto">
      <PartnerNodeItem
        v-for="{ nodeId, title, price } in creditsBadges"
        :key="nodeId"
        :title
        :price
      />
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
