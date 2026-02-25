<template>
  <div class="flex items-center gap-2 px-2 py-1.5">
    <!-- Category filter buttons -->
    <button
      v-if="hasBlueprintNodes"
      type="button"
      :class="chipClass(activeCategory === BLUEPRINT_CATEGORY)"
      @click="emit('selectCategory', BLUEPRINT_CATEGORY)"
    >
      {{ t('g.blueprints') }}
    </button>
    <button
      v-if="hasPartnerNodes"
      type="button"
      :class="chipClass(activeCategory === 'partner-nodes')"
      @click="emit('selectCategory', 'partner-nodes')"
    >
      {{ t('g.partnerNodes') }}
    </button>
    <button
      v-if="hasEssentialNodes"
      type="button"
      :class="chipClass(activeCategory === 'essentials')"
      @click="emit('selectCategory', 'essentials')"
    >
      {{ t('g.essentials') }}
    </button>
    <button
      type="button"
      :class="chipClass(activeCategory === 'custom')"
      @click="emit('selectCategory', 'custom')"
    >
      {{ t('g.extensions') }}
    </button>

    <!-- Input filter (multi-select popover) -->
    <NodeSearchTypeFilterPopover
      :chip="inputChip"
      :selected-values="selectedInputValues"
      @toggle="(v) => emit('toggleFilter', inputChip.filter, v)"
      @clear="emit('clearFilterGroup', inputChip.filter.id)"
      @escape-close="emit('focusSearch')"
    >
      <button
        type="button"
        :class="chipClass(false, selectedInputValues.length > 0)"
      >
        <span v-if="selectedInputValues.length > 0" class="flex items-center">
          <span
            v-for="val in selectedInputValues.slice(0, 4)"
            :key="val"
            class="text-lg leading-none -mx-[4px]"
            :style="{ color: getLinkTypeColor(val) }"
            >&bull;</span
          >
        </span>
        {{ inputChip.label }}
        <i class="icon-[lucide--chevron-down] size-3.5" />
      </button>
    </NodeSearchTypeFilterPopover>

    <!-- Output filter (multi-select popover) -->
    <NodeSearchTypeFilterPopover
      :chip="outputChip"
      :selected-values="selectedOutputValues"
      @toggle="(v) => emit('toggleFilter', outputChip.filter, v)"
      @clear="emit('clearFilterGroup', outputChip.filter.id)"
      @escape-close="emit('focusSearch')"
    >
      <button
        type="button"
        :class="chipClass(false, selectedOutputValues.length > 0)"
      >
        <span v-if="selectedOutputValues.length > 0" class="flex items-center">
          <span
            v-for="val in selectedOutputValues.slice(0, 4)"
            :key="val"
            class="text-lg leading-none -mx-[4px]"
            :style="{ color: getLinkTypeColor(val) }"
            >&bull;</span
          >
        </span>
        {{ outputChip.label }}
        <i class="icon-[lucide--chevron-down] size-3.5" />
      </button>
    </NodeSearchTypeFilterPopover>
  </div>
</template>

<script lang="ts">
import type { FuseFilter } from '@/utils/fuseUtil'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

export interface FilterChip {
  key: string
  label: string
  filter: FuseFilter<ComfyNodeDefImpl, string>
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import NodeSearchTypeFilterPopover from '@/components/searchbox/v2/NodeSearchTypeFilterPopover.vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { NodeSourceType } from '@/types/nodeSource'
import type { FuseFilterWithValue } from '@/utils/fuseUtil'
import { getLinkTypeColor } from '@/utils/litegraphUtil'
import { cn } from '@/utils/tailwindUtil'

const { filters = [], activeCategory = null } = defineProps<{
  filters?: FuseFilterWithValue<ComfyNodeDefImpl, string>[]
  activeCategory?: string | null
}>()

const emit = defineEmits<{
  toggleFilter: [filterDef: FuseFilter<ComfyNodeDefImpl, string>, value: string]
  clearFilterGroup: [filterId: string]
  focusSearch: []
  selectCategory: [category: string]
}>()

const BLUEPRINT_CATEGORY = 'Subgraph Blueprints'

const { t } = useI18n()
const { flags } = useFeatureFlags()
const nodeDefStore = useNodeDefStore()

const inputChip = computed<FilterChip>(() => ({
  key: 'input',
  label: t('g.input'),
  filter: nodeDefStore.nodeSearchService.inputTypeFilter
}))

const outputChip = computed<FilterChip>(() => ({
  key: 'output',
  label: t('g.output'),
  filter: nodeDefStore.nodeSearchService.outputTypeFilter
}))

const selectedInputValues = computed(() =>
  filters.filter((f) => f.filterDef.id === 'input').map((f) => f.value)
)

const selectedOutputValues = computed(() =>
  filters.filter((f) => f.filterDef.id === 'output').map((f) => f.value)
)

const hasBlueprintNodes = computed(() =>
  nodeDefStore.visibleNodeDefs.some((n) =>
    n.category.startsWith(BLUEPRINT_CATEGORY)
  )
)

const hasPartnerNodes = computed(() =>
  nodeDefStore.visibleNodeDefs.some((n) => n.api_node)
)

const hasEssentialNodes = computed(
  () =>
    flags.nodeLibraryEssentialsEnabled &&
    nodeDefStore.visibleNodeDefs.some(
      (n) => n.nodeSource.type === NodeSourceType.Essentials
    )
)

function chipClass(isActive: boolean, forceHover = false) {
  return cn(
    'flex cursor-pointer items-center justify-center gap-1 rounded-md border px-3 py-1 text-sm transition-colors border-secondary-background',
    isActive
      ? 'bg-base-foreground text-base-background border-base-foreground'
      : forceHover
        ? 'bg-transparent border-base-foreground/60 text-base-foreground/60 hover:border-base-foreground/60 hover:text-base-foreground/60'
        : 'bg-transparent text-muted-foreground hover:border-base-foreground/60 hover:text-base-foreground/60'
  )
}
</script>
