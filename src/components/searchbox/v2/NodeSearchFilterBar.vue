<template>
  <div class="flex items-center gap-2 px-2 py-1.5">
    <!-- Category filter buttons -->
    <button
      v-for="chip in categoryChips"
      :key="chip.category"
      type="button"
      :aria-pressed="activeCategory === chip.category"
      :class="chipClass(activeCategory === chip.category)"
      @click="emit('selectCategory', chip.category)"
    >
      {{ chip.label }}
    </button>

    <!-- Type filter popovers (input/output) -->
    <NodeSearchTypeFilterPopover
      v-for="{ chip, selectedValues } in typeFilterChips"
      :key="chip.key"
      :chip="chip"
      :selected-values="selectedValues"
      @toggle="(v) => emit('toggleFilter', chip.filter, v)"
      @clear="emit('clearFilterGroup', chip.filter.id)"
      @escape-close="emit('focusSearch')"
    >
      <button
        type="button"
        :class="chipClass(false, selectedValues.length > 0)"
      >
        <span v-if="selectedValues.length > 0" class="flex items-center">
          <span
            v-for="val in selectedValues.slice(0, 4)"
            :key="val"
            class="text-lg leading-none -mx-[2px]"
            :style="{ color: getLinkTypeColor(val) }"
            >&bull;</span
          >
        </span>
        {{ chip.label }}
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

const typeFilterChips = computed(() => {
  const { inputTypeFilter, outputTypeFilter } = nodeDefStore.nodeSearchService
  return [
    { key: 'input', label: t('g.input'), filter: inputTypeFilter },
    { key: 'output', label: t('g.output'), filter: outputTypeFilter }
  ].map((chip) => ({
    chip,
    selectedValues: filters
      .filter((f) => f.filterDef.id === chip.key)
      .map((f) => f.value)
  }))
})

const categoryChips = computed(() => {
  const chips: { category: string; label: string }[] = []
  const defs = nodeDefStore.visibleNodeDefs
  if (defs.some((n) => n.category.startsWith(BLUEPRINT_CATEGORY)))
    chips.push({ category: BLUEPRINT_CATEGORY, label: t('g.blueprints') })
  if (defs.some((n) => n.api_node))
    chips.push({ category: 'partner-nodes', label: t('g.partnerNodes') })
  if (
    flags.nodeLibraryEssentialsEnabled &&
    defs.some((n) => n.nodeSource.type === NodeSourceType.Essentials)
  )
    chips.push({ category: 'essentials', label: t('g.essentials') })
  chips.push({ category: 'custom', label: t('g.extensions') })
  return chips
})

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
