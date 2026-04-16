<template>
  <div
    class="option-container flex w-full cursor-pointer items-center justify-between overflow-hidden"
  >
    <div class="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
      <!-- Row 1: Name (left) + badges (right) -->
      <div class="text-foreground flex items-center gap-2 text-sm">
        <span
          v-if="isBookmarked && !hideBookmarkIcon"
          role="img"
          :aria-label="$t('g.bookmarked')"
        >
          <i aria-hidden="true" class="pi pi-bookmark-fill mr-1 text-sm" />
        </span>
        <span
          class="truncate"
          v-html="highlightQuery(nodeDef.display_name, currentQuery)"
        />
        <span
          v-if="showIdName"
          class="shrink-0 rounded-sm bg-secondary-background px-1.5 py-0.5 text-xs text-muted-foreground"
          v-html="highlightQuery(nodeDef.name, currentQuery)"
        />

        <template v-if="showDescription">
          <div class="flex-1" />
          <div class="flex shrink-0 items-center gap-1">
            <span
              v-if="showSourceBadge && isCore"
              aria-hidden="true"
              class="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-secondary-background-hover/80"
            >
              <ComfyLogo :size="10" mode="fill" color="currentColor" />
            </span>
            <span
              v-else-if="showSourceBadge && isCustom"
              :class="badgePillClass"
            >
              <span class="truncate text-2xs">
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

      <div
        v-if="showDescription"
        class="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
      >
        <span v-if="showCategory" class="max-w-2/5 shrink-0 truncate">
          {{ nodeDef.category.replaceAll('/', ' / ') }}
        </span>
        <span
          v-if="nodeDef.description && showCategory"
          class="h-3 w-px shrink-0 bg-border-default"
        />
        <TextTicker v-if="nodeDef.description" class="min-w-0 flex-1">
          {{ nodeDef.description }}
        </TextTicker>
      </div>
    </div>
    <div v-if="!showDescription" class="flex items-center gap-1">
      <span
        v-if="nodeDef.deprecated"
        class="rounded-sm bg-red-500/20 px-1.5 py-0.5 text-xs text-red-400"
      >
        {{ $t('g.deprecated') }}
      </span>
      <span
        v-if="nodeDef.experimental"
        class="rounded-sm bg-blue-500/20 px-1.5 py-0.5 text-xs text-blue-400"
      >
        {{ $t('g.experimental') }}
      </span>
      <span
        v-if="nodeDef.dev_only"
        class="rounded-sm bg-cyan-500/20 px-1.5 py-0.5 text-xs text-cyan-400"
      >
        {{ $t('g.devOnly') }}
      </span>
      <span
        v-if="showNodeFrequency && nodeFrequency > 0"
        data-testid="frequency-badge"
        class="rounded-sm bg-secondary-background px-1.5 py-0.5 text-xs text-muted-foreground"
      >
        {{ formatNumberWithSuffix(nodeFrequency, { roundToInt: true }) }}
      </span>
      <span
        v-if="nodeDef.nodeSource.type !== NodeSourceType.Unknown"
        class="rounded-sm bg-secondary-background px-2 py-0.5 text-sm text-muted-foreground"
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
  CORE_NODE_MODULES,
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
  'flex h-[18px] max-w-28 shrink-0 items-center justify-center gap-1 rounded-full bg-secondary-background-hover/80 px-2'

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
const isCore = computed(() =>
  CORE_NODE_MODULES.includes(nodeDef.python_module.split('.')[0])
)
const isCustom = computed(() => isCustomNodeDef(nodeDef))
</script>
