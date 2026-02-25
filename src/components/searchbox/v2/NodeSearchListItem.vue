<template>
  <div
    class="option-container flex w-full cursor-pointer items-center justify-between overflow-hidden"
  >
    <div class="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
      <!-- Row 1: Name (left) + badges (right) -->
      <div class="flex items-center gap-2 font-semibold text-foreground">
        <span v-if="isBookmarked && !hideBookmarkIcon">
          <i class="pi pi-bookmark-fill mr-1 text-sm" />
        </span>
        <span
          class="truncate"
          v-html="highlightQuery(nodeDef.display_name, currentQuery)"
        />
        <span v-if="showIdName">&nbsp;</span>
        <span
          v-if="showIdName"
          class="shrink-0 rounded bg-secondary-background px-1.5 py-0.5 text-xs text-muted-foreground"
          v-html="highlightQuery(nodeDef.name, currentQuery)"
        />

        <template v-if="showDescription">
          <div class="flex-1" />
          <div class="flex shrink-0 items-center gap-1">
            <span
              v-if="showSourceBadge && !isCustomNode"
              aria-hidden="true"
              class="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-secondary-background-selected"
            >
              <ComfyLogo :size="10" mode="fill" color="currentColor" />
            </span>
            <span
              v-else-if="showSourceBadge && isCustomNode"
              :class="badgePillClass"
            >
              <span class="truncate text-[10px]">
                {{ nodeDef.nodeSource.displayText }}
              </span>
            </span>

            <span
              v-if="nodeDef.api_node && providerName"
              :class="badgePillClass"
            >
              <i
                aria-hidden="true"
                class="icon-[lucide--component] size-3 text-amber-400"
              />
              <i
                aria-hidden="true"
                :class="cn(getProviderIcon(providerName), 'size-3')"
              />
            </span>
          </div>
        </template>
        <template v-else>
          <NodePricingBadge :node-def="nodeDef" />
          <NodeProviderBadge v-if="nodeDef.api_node" :node-def="nodeDef" />
        </template>
      </div>

      <div v-if="showDescription" class="text-[11px] text-muted-foreground">
        <TextTicker v-if="nodeDef.description">
          {{ nodeDef.description }}
        </TextTicker>
      </div>
      <div
        v-else-if="showCategory"
        class="option-category truncate text-sm font-light text-muted"
      >
        {{ nodeDef.category.replaceAll('/', ' > ') }}
      </div>
    </div>
    <div v-if="!showDescription" class="flex items-center gap-1">
      <span
        v-if="nodeDef.deprecated"
        class="rounded bg-red-500/20 px-1.5 py-0.5 text-xs text-red-400"
      >
        {{ $t('g.deprecated') }}
      </span>
      <span
        v-if="nodeDef.experimental"
        class="rounded bg-blue-500/20 px-1.5 py-0.5 text-xs text-blue-400"
      >
        {{ $t('g.experimental') }}
      </span>
      <span
        v-if="nodeDef.dev_only"
        class="rounded bg-cyan-500/20 px-1.5 py-0.5 text-xs text-cyan-400"
      >
        {{ $t('g.devOnly') }}
      </span>
      <span
        v-if="showNodeFrequency && nodeFrequency > 0"
        class="rounded bg-secondary-background px-1.5 py-0.5 text-xs text-muted-foreground"
      >
        {{ formatNumberWithSuffix(nodeFrequency, { roundToInt: true }) }}
      </span>
      <span
        v-if="nodeDef.nodeSource.type !== NodeSourceType.Unknown"
        class="rounded bg-secondary-background px-2 py-0.5 text-sm text-muted-foreground"
      >
        {{ nodeDef.nodeSource.displayText }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import TextTicker from '@/components/common/TextTicker.vue'
import ComfyLogo from '@/components/icons/ComfyLogo.vue'
import NodePricingBadge from '@/components/node/NodePricingBadge.vue'
import NodeProviderBadge from '@/components/node/NodeProviderBadge.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeFrequencyStore } from '@/stores/nodeDefStore'
import {
  isCustomNode as isCustomNodeDef,
  NodeSourceType
} from '@/types/nodeSource'
import { getProviderIcon, getProviderName } from '@/utils/categoryUtil'
import { formatNumberWithSuffix, highlightQuery } from '@/utils/formatUtil'
import { cn } from '@/utils/tailwindUtil'

const {
  nodeDef,
  currentQuery,
  showDescription = false,
  showSourceBadge = false,
  hideBookmarkIcon = false
} = defineProps<{
  nodeDef: ComfyNodeDefImpl
  currentQuery: string
  showDescription?: boolean
  showSourceBadge?: boolean
  hideBookmarkIcon?: boolean
}>()

const badgePillClass =
  'flex h-[18px] max-w-28 shrink-0 items-center justify-center gap-1 rounded-full bg-secondary-background-selected px-2'

const settingStore = useSettingStore()
const showCategory = computed(() =>
  settingStore.get('Comfy.NodeSearchBoxImpl.ShowCategory')
)
const showIdName = computed(() =>
  settingStore.get('Comfy.NodeSearchBoxImpl.ShowIdName')
)
const showNodeFrequency = computed(() =>
  settingStore.get('Comfy.NodeSearchBoxImpl.ShowNodeFrequency')
)
const nodeFrequencyStore = useNodeFrequencyStore()
const nodeFrequency = computed(() =>
  nodeFrequencyStore.getNodeFrequency(nodeDef)
)

const nodeBookmarkStore = useNodeBookmarkStore()
const isBookmarked = computed(() => nodeBookmarkStore.isBookmarked(nodeDef))
const providerName = computed(() => getProviderName(nodeDef.category))
const isCustomNode = computed(() => isCustomNodeDef(nodeDef))
</script>

<style scoped>
:deep(.highlight) {
  background-color: color-mix(in srgb, currentColor 20%, transparent);
  font-weight: 700;
  border-radius: 0.25rem;
  padding: 0 0.125rem;
  margin: -0.125rem 0.125rem;
}
</style>
