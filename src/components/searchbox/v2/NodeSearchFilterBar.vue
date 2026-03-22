<template>
  <div class="flex items-center gap-2.5 px-3">
    <!-- Category filter buttons -->
    <button
      v-for="btn in categoryButtons"
      :key="btn.id"
      type="button"
      :aria-pressed="activeCategory === btn.id"
      :class="chipClass(activeCategory === btn.id)"
      @click="emit('selectCategory', btn.id)"
    >
      {{ btn.label }}
    </button>

    <div class="h-5 w-px shrink-0 bg-border-subtle" />

    <!-- Type filter popovers (Input / Output) -->
    <NodeSearchTypeFilterPopover
      v-for="tf in typeFilters"
      :key="tf.chip.key"
      :chip="tf.chip"
      :selected-values="tf.values"
      @toggle="(v) => emit('toggleFilter', tf.chip.filter, v)"
      @clear="emit('clearFilterGroup', tf.chip.filter.id)"
      @escape-close="emit('focusSearch')"
    >
      <button type="button" :class="chipClass(false, tf.values.length > 0)">
        <span v-if="tf.values.length > 0" class="flex items-center">
          <span
            v-for="val in tf.values.slice(0, MAX_VISIBLE_DOTS)"
            :key="val"
            class="-mx-[2px] text-lg leading-none"
            :style="{ color: getLinkTypeColor(val) }"
            >&bull;</span
          >
        </span>
        {{ tf.chip.label }}
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
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { BLUEPRINT_CATEGORY } from '@/types/nodeSource'
import type { FuseFilterWithValue } from '@/utils/fuseUtil'
import { getLinkTypeColor } from '@/utils/litegraphUtil'
import { cn } from '@/utils/tailwindUtil'

const {
  filters = [],
  activeCategory = null,
  hasFavorites = false,
  hasEssentialNodes = false,
  hasBlueprintNodes = false,
  hasPartnerNodes = false,
  hasCustomNodes = false
} = defineProps<{
  filters?: FuseFilterWithValue<ComfyNodeDefImpl, string>[]
  activeCategory?: string | null
  hasFavorites?: boolean
  hasEssentialNodes?: boolean
  hasBlueprintNodes?: boolean
  hasPartnerNodes?: boolean
  hasCustomNodes?: boolean
}>()

const emit = defineEmits<{
  toggleFilter: [filterDef: FuseFilter<ComfyNodeDefImpl, string>, value: string]
  clearFilterGroup: [filterId: string]
  focusSearch: []
  selectCategory: [category: string]
}>()

const { t } = useI18n()
const nodeDefStore = useNodeDefStore()

const MAX_VISIBLE_DOTS = 4

const categoryButtons = computed(() => {
  const buttons: { id: string; label: string }[] = []
  if (hasFavorites) {
    buttons.push({ id: 'favorites', label: t('g.bookmarked') })
  }
  if (hasBlueprintNodes) {
    buttons.push({ id: BLUEPRINT_CATEGORY, label: t('g.blueprints') })
  }
  if (hasEssentialNodes) {
    buttons.push({ id: 'essentials', label: t('g.essentials') })
  }
  buttons.push({ id: 'comfy', label: t('g.comfy') })
  if (hasPartnerNodes) {
    buttons.push({ id: 'partner-nodes', label: t('g.partner') })
  }
  if (hasCustomNodes) {
    buttons.push({ id: 'custom', label: t('g.extensions') })
  }
  return buttons
})

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

const typeFilters = computed(() => [
  { chip: inputChip.value, values: selectedInputValues.value },
  { chip: outputChip.value, values: selectedOutputValues.value }
])

function chipClass(isActive: boolean, hasSelections = false) {
  return cn(
    'flex cursor-pointer items-center justify-center gap-1 rounded-md border border-secondary-background px-3 py-1 font-inter text-sm transition-colors',
    isActive
      ? 'border-base-foreground bg-base-foreground text-base-background'
      : hasSelections
        ? 'border-base-foreground/60 bg-transparent text-base-foreground/60 hover:border-base-foreground/60 hover:text-base-foreground/60'
        : 'bg-transparent text-muted-foreground hover:border-base-foreground/60 hover:text-base-foreground/60'
  )
}
</script>
