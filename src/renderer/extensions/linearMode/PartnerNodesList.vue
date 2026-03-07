<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'
import { computed, toValue } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { usePriceBadge } from '@/composables/node/usePriceBadge'
import { app } from '@/scripts/app'
import { mapAllNodes } from '@/utils/graphTraversalUtil'

const { isCreditsBadge } = usePriceBadge()
const { t } = useI18n()

const creditsBadges = computed(() =>
  mapAllNodes(app.graph, (node) => {
    if (node.isSubgraphNode()) return

    const priceBadge = node.badges.find(isCreditsBadge)
    if (!priceBadge) return

    return [node.title, toValue(priceBadge).text]
  })
)
</script>
<template>
  <CollapsibleRoot v-slot="{ open }" class="w-full">
    <div
      v-if="creditsBadges.length"
      class="w-full border-b border-border-subtle"
    />
    <CollapsibleTrigger as-child>
      <Button variant="textonly" class="w-full text-sm">
        <i class="icon-[comfy--credits] size-4 bg-amber-400" />
        {{ t('linearMode.hasCreditCost') }}
        <i v-if="open" class="ml-auto icon-[lucide--chevron-up]" />
        <i v-else class="ml-auto icon-[lucide--chevron-down]" />
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent class="scrollbar-custom overflow-y-auto">
      <div v-for="[title, badge] in creditsBadges" :key="title">
        <div class="text-muted-foreground" v-text="title" />
        <span
          class="mt-2 mb-4 flex h-5 max-w-max items-center rounded-full bg-component-node-widget-background p-2 py-3"
        >
          <i class="mr-1 icon-[lucide--component] h-4 bg-amber-400" />
          {{ badge }}
        </span>
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
