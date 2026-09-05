<script setup lang="ts">
import {
  ArrowUpDown,
  ChevronDown,
  LayoutGrid,
  SlidersHorizontal
} from '@lucide/vue'
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import type { Component } from 'vue'
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { FacetTemplate, FacetValue } from '../../composables/useFacets'
import { useFacets } from '../../composables/useFacets'
import type { FilterBadge, HubTab } from '../../composables/useHubStore'
import { useHubStore } from '../../composables/useHubStore'
import IconApps from './IconApps.vue'
import IconModel from './IconModel.vue'
import IconWorkflow from './IconWorkflow.vue'

export interface FacetGroupConfig {
  readonly key: string
  readonly type: FilterBadge['type']
  readonly label: string
}

export interface ToolbarLabels {
  readonly all: string
  readonly nodeGraphs: string
  readonly comfyApps: string
  readonly models: string
  readonly filter: string
  readonly clearAll: string
  readonly applied: string
  readonly searchPlaceholder: string
  readonly noResults: string
  readonly more: string
  readonly less: string
  readonly sortPopular: string
  readonly sortNewest: string
  readonly showResults: string
}

const { templates, facetsConfig, labels, resultCount } = defineProps<{
  templates: readonly FacetTemplate[]
  facetsConfig: readonly FacetGroupConfig[]
  labels: ToolbarLabels
  resultCount: number
}>()

const store = useHubStore()
const facetInput = computed(() => templates)
const { facetsByType, isBadgeActive, activeCountForType } =
  useFacets(facetInput)

// A facet with sixty values cannot be read as a wall of chips: each group opens
// with the values that carry the most workflows and hides the tail behind a
// count, the way the rest of the catalogue reveals long lists.
const CHIP_LIMIT = 10
const SEARCH_THRESHOLD = 12

const TABS: { key: HubTab; labelKey: keyof ToolbarLabels; icon: Component }[] =
  [
    { key: 'all', labelKey: 'all', icon: LayoutGrid },
    { key: 'nodeGraphs', labelKey: 'nodeGraphs', icon: IconWorkflow },
    { key: 'comfyApps', labelKey: 'comfyApps', icon: IconApps },
    { key: 'models', labelKey: 'models', icon: IconModel }
  ]

const filterOpen = ref(false)
const facetSearch = ref<Record<string, string>>({})
const expanded = ref<Record<string, boolean>>({})

const totalActiveFilters = computed(() =>
  facetsConfig.reduce((sum, cfg) => sum + activeCountForType(cfg.type), 0)
)

const groups = computed(() =>
  facetsConfig.map((cfg) => ({
    ...cfg,
    values: facetsByType.value[cfg.type].values
  }))
)

interface FacetGroup {
  readonly key: string
  readonly type: FilterBadge['type']
  readonly values: readonly FacetValue[]
}

function matchingValues(group: FacetGroup): readonly FacetValue[] {
  const q = (facetSearch.value[group.key] ?? '').trim().toLowerCase()
  return q
    ? group.values.filter((v) => v.displayValue.toLowerCase().includes(q))
    : group.values
}

// A chosen value stays in sight even when its count puts it in the tail.
function visibleValues(group: FacetGroup): readonly FacetValue[] {
  const values = matchingValues(group)
  if (expanded.value[group.key]) return values
  const chosen = values.filter((v) => isBadgeActive(group.type, v.value))
  const rest = values.filter((v) => !isBadgeActive(group.type, v.value))
  return [...chosen, ...rest].slice(0, CHIP_LIMIT)
}

function hiddenCount(group: FacetGroup): number {
  return expanded.value[group.key]
    ? 0
    : matchingValues(group).length - visibleValues(group).length
}

const sortLabel = computed(() =>
  store.sortBy.value === 'popular' ? labels.sortPopular : labels.sortNewest
)

const controlClass =
  'inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand sm:px-4'

// Every facet is on the panel at once, so a value is a chip you switch on
// rather than a row you find behind a tab.
const chipClass = (active: boolean) =>
  cn(
    'focus-visible:ring-brand inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors outline-none focus-visible:ring-2',
    active
      ? 'border-brand bg-brand text-page'
      : 'text-content-secondary hover:text-content border-white/15 hover:border-white/30'
  )
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <TabsRoot
        :model-value="store.activeTab.value"
        class="flex scrollbar-hide min-w-0 shrink-0 overflow-x-auto"
        @update:model-value="store.setTab($event as HubTab)"
      >
        <TabsList
          class="inline-flex items-center gap-1 rounded-xl bg-white/8 p-1"
        >
          <TabsTrigger
            v-for="tab in TABS"
            :key="tab.key"
            :value="tab.key"
            :aria-label="labels[tab.labelKey]"
            :data-testid="`hub-tab-${tab.key}`"
            class="group text-content-secondary hover:text-content focus-visible:ring-brand focus-visible:ring-offset-page data-[state=active]:bg-primary-warm-white data-[state=active]:text-page data-[state=active]:hover:bg-primary-warm-white inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap transition-colors outline-none hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-offset-1 sm:px-3.5"
          >
            <component
              :is="tab.icon"
              class="size-3.5 shrink-0"
              aria-hidden="true"
            />
            <span
              class="ppformula-text-center-sm max-sm:hidden max-sm:group-data-[state=active]:inline-block"
            >
              {{ labels[tab.labelKey] }}
            </span>
          </TabsTrigger>
        </TabsList>
      </TabsRoot>

      <div class="ml-auto flex min-w-0 items-center gap-2">
        <slot name="search" />
        <button
          type="button"
          :aria-expanded="filterOpen"
          :aria-label="labels.filter"
          data-testid="hub-filter"
          :class="
            cn(
              controlClass,
              totalActiveFilters > 0
                ? 'bg-brand text-page hover:bg-brand/90'
                : 'text-content-secondary hover:text-content bg-white/8 hover:bg-white/12'
            )
          "
          @click="filterOpen = !filterOpen"
        >
          <SlidersHorizontal class="size-3.5 shrink-0" aria-hidden="true" />
          <span class="ppformula-text-center-sm max-sm:hidden">{{
            labels.filter
          }}</span>
          <span
            v-if="totalActiveFilters > 0"
            class="bg-page/15 ml-0.5 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-2xs font-bold tabular-nums"
            data-testid="hub-filter-count"
          >
            {{ totalActiveFilters }}
          </span>
          <ChevronDown
            :class="
              cn(
                'size-3 transition-transform max-sm:hidden',
                filterOpen && 'rotate-180'
              )
            "
            aria-hidden="true"
          />
        </button>

        <button
          type="button"
          :aria-label="sortLabel"
          data-testid="hub-sort"
          :class="
            cn(
              controlClass,
              'text-content-secondary hover:text-content bg-white/8 hover:bg-white/12'
            )
          "
          @click="store.cycleSort()"
        >
          <ArrowUpDown class="size-3.5 shrink-0" aria-hidden="true" />
          <span class="ppformula-text-center-sm max-sm:hidden">{{
            sortLabel
          }}</span>
        </button>
      </div>
    </div>

    <div
      v-if="filterOpen"
      class="bg-site-dropdown flex flex-col gap-5 rounded-2xl border border-white/10 p-5"
      data-testid="hub-filter-menu"
    >
      <div v-for="group in groups" :key="group.key" class="flex flex-col gap-2">
        <div class="flex items-center gap-3">
          <h3
            class="text-content-muted text-2xs font-bold tracking-wider uppercase"
            :data-testid="`hub-facet-${group.key}`"
          >
            {{ group.label }}
          </h3>
          <input
            v-if="expanded[group.key] && group.values.length > SEARCH_THRESHOLD"
            v-model="facetSearch[group.key]"
            type="search"
            :placeholder="labels.searchPlaceholder"
            :data-testid="`hub-facet-search-${group.key}`"
            class="text-content placeholder:text-content-muted focus-visible:ring-brand w-48 rounded-lg bg-white/5 px-3 py-1.5 text-xs outline-none focus-visible:ring-2 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        <div
          :class="
            cn(
              'flex flex-wrap gap-2',
              expanded[group.key] &&
                'max-h-56 scrollbar-thin content-start overflow-y-auto'
            )
          "
          role="listbox"
          aria-multiselectable="true"
        >
          <button
            v-for="val in visibleValues(group)"
            :key="val.value"
            type="button"
            role="option"
            :aria-selected="isBadgeActive(group.type, val.value)"
            :class="chipClass(isBadgeActive(group.type, val.value))"
            @click="store.toggleBadge({ type: group.type, value: val.value })"
          >
            {{ val.displayValue }}
            <span class="tabular-nums opacity-50">{{ val.count }}</span>
          </button>
          <p
            v-if="visibleValues(group).length === 0"
            class="text-content-muted py-1 text-xs"
          >
            {{ labels.noResults }}
          </p>
        </div>

        <button
          v-if="hiddenCount(group) > 0 || expanded[group.key]"
          type="button"
          class="hover:text-brand focus-visible:ring-brand w-fit cursor-pointer rounded-lg text-xs font-semibold text-content-secondary transition-colors outline-none focus-visible:ring-2"
          :data-testid="`hub-facet-more-${group.key}`"
          @click="expanded[group.key] = !expanded[group.key]"
        >
          {{
            expanded[group.key]
              ? labels.less
              : labels.more.replace('{n}', String(hiddenCount(group)))
          }}
        </button>
      </div>

      <div
        class="flex items-center justify-between gap-3 border-t border-white/10 pt-4"
      >
        <span
          v-if="totalActiveFilters > 0"
          class="text-content-secondary text-xs"
          data-testid="hub-filter-applied"
        >
          {{ labels.applied.replace('{n}', String(totalActiveFilters)) }}
        </span>
        <button
          v-if="totalActiveFilters > 0"
          type="button"
          class="text-content-secondary hover:text-content mr-auto rounded-lg px-3 py-2 text-xs font-semibold transition-colors hover:bg-white/5"
          data-testid="hub-filter-clear"
          @click="store.clearBadges()"
        >
          {{ labels.clearAll }}
        </button>
        <button
          type="button"
          class="bg-brand text-page hover:bg-brand/90 focus-visible:ring-brand ml-auto cursor-pointer rounded-xl px-5 py-2.5 text-xs font-bold transition-colors outline-none focus-visible:ring-2"
          data-testid="hub-filter-show"
          @click="filterOpen = false"
        >
          {{ labels.showResults.replace('{n}', String(resultCount)) }}
        </button>
      </div>
    </div>
  </div>
</template>
