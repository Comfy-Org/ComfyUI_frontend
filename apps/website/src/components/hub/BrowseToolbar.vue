<script setup lang="ts">
import {
  ArrowUpDown,
  Boxes,
  Check,
  ChevronDown,
  LayoutGrid,
  SlidersHorizontal
} from '@lucide/vue'
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger
} from 'reka-ui'
import type { Component } from 'vue'
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { FacetTemplate, FacetValue } from '../../composables/useFacets'
import { useFacets } from '../../composables/useFacets'
import type { FilterBadge, HubTab } from '../../composables/useHubStore'
import { useHubStore } from '../../composables/useHubStore'
import IconApps from './IconApps.vue'
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
  readonly searchPlaceholder: string
  readonly noResults: string
  readonly sortPopular: string
  readonly sortNewest: string
}

const { templates, facetsConfig, labels } = defineProps<{
  templates: readonly FacetTemplate[]
  facetsConfig: readonly FacetGroupConfig[]
  labels: ToolbarLabels
}>()

const store = useHubStore()
const facetInput = computed(() => templates)
const { facetsByType, isBadgeActive, activeCountForType } =
  useFacets(facetInput)

const SEARCH_THRESHOLD = 12

const TABS: { key: HubTab; labelKey: keyof ToolbarLabels; icon: Component }[] =
  [
    { key: 'all', labelKey: 'all', icon: LayoutGrid },
    { key: 'nodeGraphs', labelKey: 'nodeGraphs', icon: IconWorkflow },
    { key: 'comfyApps', labelKey: 'comfyApps', icon: IconApps },
    { key: 'models', labelKey: 'models', icon: Boxes }
  ]

const filterOpen = ref(false)
const activeFacetTab = ref(facetsConfig[0]?.key ?? '')
const facetSearch = ref<Record<string, string>>({})

const totalActiveFilters = computed(() =>
  facetsConfig.reduce((sum, cfg) => sum + activeCountForType(cfg.type), 0)
)

const groups = computed(() =>
  facetsConfig.map((cfg) => ({
    ...cfg,
    values: facetsByType.value[cfg.type].values
  }))
)

function visibleValues(group: {
  key: string
  values: readonly FacetValue[]
}): readonly FacetValue[] {
  const q = (facetSearch.value[group.key] ?? '').trim().toLowerCase()
  return q
    ? group.values.filter((v) => v.displayValue.toLowerCase().includes(q))
    : group.values
}

const sortLabel = computed(() =>
  store.sortBy.value === 'popular' ? labels.sortPopular : labels.sortNewest
)

const controlClass =
  'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand sm:px-3.5'
</script>

<template>
  <div class="flex items-center justify-between gap-2">
    <TabsRoot
      :model-value="store.activeTab.value"
      class="flex scrollbar-hide min-w-0 overflow-x-auto"
      @update:model-value="store.setTab($event as HubTab)"
    >
      <TabsList
        class="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/8 p-1"
      >
        <TabsTrigger
          v-for="tab in TABS"
          :key="tab.key"
          :value="tab.key"
          :aria-label="labels[tab.labelKey]"
          :data-testid="`hub-tab-${tab.key}`"
          class="group text-content-secondary hover:text-content focus-visible:ring-brand focus-visible:ring-offset-page data-[state=active]:bg-brand data-[state=active]:text-page data-[state=active]:hover:bg-brand inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap transition-colors outline-none hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-offset-1 sm:px-3.5"
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

    <div class="flex shrink-0 items-center gap-2">
      <PopoverRoot v-model:open="filterOpen">
        <PopoverTrigger
          :class="
            cn(
              controlClass,
              totalActiveFilters > 0
                ? 'bg-brand text-page hover:bg-brand/90'
                : 'text-content-secondary hover:text-content border border-white/15 bg-white/8 hover:bg-white/12'
            )
          "
          :aria-label="labels.filter"
          data-testid="hub-filter"
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
        </PopoverTrigger>

        <PopoverPortal>
          <PopoverContent
            align="end"
            :side-offset="8"
            data-testid="hub-filter-menu"
            class="bg-site-dropdown z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50 outline-none"
          >
            <TabsRoot v-model="activeFacetTab" class="flex flex-col">
              <TabsList
                class="flex items-center gap-1 border-b border-white/10 p-2"
              >
                <TabsTrigger
                  v-for="group in groups"
                  :key="group.key"
                  :value="group.key"
                  :data-testid="`hub-facet-${group.key}`"
                  class="text-content-secondary hover:text-content focus-visible:ring-brand data-[state=active]:text-content inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors outline-none hover:bg-white/5 focus-visible:ring-2 data-[state=active]:bg-white/8"
                >
                  {{ group.label }}
                  <span
                    v-if="activeCountForType(group.type) > 0"
                    class="bg-brand text-page inline-flex min-w-4 items-center justify-center rounded-full px-1 text-2xs font-bold tabular-nums"
                  >
                    {{ activeCountForType(group.type) }}
                  </span>
                </TabsTrigger>
              </TabsList>

              <TabsContent
                v-for="group in groups"
                :key="group.key"
                :value="group.key"
                class="flex flex-col outline-none"
              >
                <div
                  v-if="group.values.length > SEARCH_THRESHOLD"
                  class="border-b border-white/10 p-2"
                >
                  <input
                    v-model="facetSearch[group.key]"
                    type="search"
                    :placeholder="labels.searchPlaceholder"
                    :data-testid="`hub-facet-search-${group.key}`"
                    class="text-content placeholder:text-content-muted focus-visible:ring-brand w-full rounded-lg bg-white/5 px-3 py-2 text-xs outline-none focus-visible:ring-2"
                  />
                </div>
                <ul
                  class="max-h-72 scrollbar-thin overflow-y-auto py-1"
                  role="listbox"
                  aria-multiselectable="true"
                >
                  <li v-for="val in visibleValues(group)" :key="val.value">
                    <button
                      type="button"
                      role="option"
                      :aria-selected="isBadgeActive(group.type, val.value)"
                      class="text-content-secondary hover:text-content flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors outline-none hover:bg-white/5 focus-visible:bg-white/5"
                      @click="
                        store.toggleBadge({
                          type: group.type,
                          value: val.value
                        })
                      "
                    >
                      <span
                        :class="
                          cn(
                            'flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors',
                            isBadgeActive(group.type, val.value)
                              ? 'border-brand bg-brand text-page'
                              : 'border-white/25'
                          )
                        "
                        aria-hidden="true"
                      >
                        <Check
                          v-if="isBadgeActive(group.type, val.value)"
                          class="size-3"
                          :stroke-width="3"
                        />
                      </span>
                      <span class="flex-1 truncate">{{
                        val.displayValue
                      }}</span>
                      <span class="text-content/30 shrink-0 tabular-nums">{{
                        val.count
                      }}</span>
                    </button>
                  </li>
                  <li
                    v-if="visibleValues(group).length === 0"
                    class="text-content-muted px-3 py-4 text-center text-xs"
                  >
                    {{ labels.noResults }}
                  </li>
                </ul>
              </TabsContent>

              <div
                v-if="totalActiveFilters > 0"
                class="border-t border-white/10 p-2"
              >
                <button
                  type="button"
                  class="text-content-secondary hover:text-content w-full rounded-lg px-3 py-2 text-xs font-semibold transition-colors hover:bg-white/5"
                  @click="store.clearBadges()"
                >
                  {{ labels.clearAll }}
                </button>
              </div>
            </TabsRoot>
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>

      <button
        type="button"
        :aria-label="sortLabel"
        data-testid="hub-sort"
        :class="
          cn(
            controlClass,
            'text-content-secondary hover:text-content border border-white/15 bg-white/8 hover:bg-white/12'
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
</template>
