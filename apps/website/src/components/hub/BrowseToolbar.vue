<script setup lang="ts">
import {
  ArrowRight,
  ArrowUpDown,
  Check,
  ChevronDown,
  LayoutGrid,
  SlidersHorizontal,
  X
} from '@lucide/vue'
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
  TabsList,
  TabsRoot,
  TabsTrigger
} from 'reka-ui'
import type { Component } from 'vue'
import { computed, ref, useTemplateRef, watchEffect } from 'vue'

import { onClickOutside, useMediaQuery } from '@vueuse/core'

import { cn } from '@comfyorg/tailwind-utils'

import type { FacetTemplate, FacetValue } from '../../composables/useFacets'
import { useFacets } from '../../composables/useFacets'
import { useSlidingUnderline } from '../../composables/useSlidingUnderline'
import type { FilterBadge, HubTab } from '../../composables/useHubStore'
import { useHubStore } from '../../composables/useHubStore'
import IconApps from './IconApps.vue'
import IconModel from './IconModel.vue'
import IconWorkflow from './IconWorkflow.vue'

export interface FacetGroupConfig {
  readonly key: string
  readonly type: FilterBadge['type']
  readonly label: string
  /** How the group is drawn: one row of options, chips, or a dropdown. */
  readonly display: 'segmented' | 'chips' | 'select'
  /** What "nothing chosen" reads as, and the link that opens the whole list. */
  readonly allLabel: string
  /** How many chips the group opens with, when it holds more than it shows. */
  readonly limit?: number
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
  readonly less: string
  readonly selected: string
  readonly typeAll: string
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
// with the values that carry the most workflows and keeps the tail behind a
// link.
const CHIP_LIMIT = 6
const SEARCH_THRESHOLD = 12

const TABS: { key: HubTab; labelKey: keyof ToolbarLabels; icon: Component }[] =
  [
    { key: 'all', labelKey: 'all', icon: LayoutGrid },
    { key: 'nodeGraphs', labelKey: 'nodeGraphs', icon: IconWorkflow },
    { key: 'comfyApps', labelKey: 'comfyApps', icon: IconApps },
    { key: 'models', labelKey: 'models', icon: IconModel }
  ]

const tabsRef = useTemplateRef<{ $el: HTMLElement }>('tabs')
const tabsEl = computed(() => tabsRef.value?.$el ?? null)
const pill = useSlidingUnderline(
  tabsEl,
  () => store.activeTab.value,
  '[data-state="active"]'
)

const filterOpen = ref(false)
// A sheet has to escape the toolbar to reach the bottom of the screen: an
// ancestor that blurs its backdrop would otherwise anchor it.
const isPhone = useMediaQuery('(max-width: 639px)')

// On a phone the panel is a sheet over the page, so the grid behind it stays
// where it was left.
watchEffect((onCleanup) => {
  if (!filterOpen.value || !isPhone.value) return
  const previous = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  onCleanup(() => (document.body.style.overflow = previous))
})
const panel = useTemplateRef<HTMLElement>('panel')
onClickOutside(panel, () => (filterOpen.value = false), {
  ignore: ['[data-testid="hub-filter"]', '[data-reka-popper-content-wrapper]']
})
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
  readonly limit?: number
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
  return [...chosen, ...rest].slice(0, group.limit ?? CHIP_LIMIT)
}

function hiddenCount(group: FacetGroup): number {
  return expanded.value[group.key]
    ? 0
    : matchingValues(group).length - visibleValues(group).length
}

const chosenMedia = computed(() =>
  facetsByType.value.media.values.find((value) =>
    isBadgeActive('media', value.value)
  )
)

const groupLabel = (group: FacetGroupConfig) =>
  group.type === 'tag' && chosenMedia.value
    ? `${group.label} · ${chosenMedia.value.displayValue}`
    : group.label

const selectLabel = (group: FacetGroupConfig) => {
  const chosen = activeCountForType(group.type)
  return chosen === 0
    ? group.allLabel
    : labels.selected.replace('{n}', String(chosen))
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
    'focus-visible:ring-brand inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors outline-none focus-visible:ring-2',
    active
      ? 'border-brand bg-brand text-page font-medium'
      : 'text-content border-white/15 hover:border-white/40'
  )

// One choice out of a short list reads as a single control, so the options
// share a border instead of each carrying their own.
const segmentClass = (active: boolean) =>
  cn(
    'focus-visible:ring-brand cursor-pointer rounded-full px-4 py-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2',
    active
      ? 'bg-brand text-page font-medium'
      : 'text-content hover:text-primary-warm-white'
  )

const groupTitleClass = 'text-content-muted text-base'

// A phone shows the facets the way the hub does: one at a time, behind a row of
// names, with a search and a list you tick. The wide panel keeps its chips.
const phoneFacet = ref<string>()
const facetTabs = computed(() =>
  groups.value.map((group) => ({ key: group.key, label: group.label }))
)
const currentFacet = computed(
  () => phoneFacet.value ?? facetTabs.value[0]?.key ?? ''
)
const currentGroup = computed(() =>
  groups.value.find((group) => group.key === currentFacet.value)
)
const phoneOptions = computed(() => {
  const group = currentGroup.value
  return group
    ? matchingValues(group).map((value) => ({
        value: value.value,
        label: value.displayValue,
        count: value.count
      }))
    : []
})
const isPhoneChosen = (value: string) => {
  const group = currentGroup.value
  return group ? isBadgeActive(group.type, value) : false
}

function phoneToggle(value: string) {
  const group = currentGroup.value
  if (!group) return
  const badge = { type: group.type, value }
  if (group.display === 'segmented') store.selectBadge(badge)
  else store.toggleBadge(badge)
}
</script>

<template>
  <div class="relative flex flex-col gap-3">
    <!-- Tabs and search share one row: below sm the row may wrap, from there
      up the search shrinks instead of dropping under the tabs. -->
    <div class="flex flex-wrap items-center gap-2 sm:flex-nowrap">
      <TabsRoot
        ref="tabs"
        :model-value="store.activeTab.value"
        class="flex scrollbar-hide min-w-0 shrink-0 overflow-x-auto"
        @update:model-value="store.setTab($event as HubTab)"
      >
        <TabsList
          class="relative inline-flex items-center gap-1 rounded-xl bg-white/8 p-1"
        >
          <span
            aria-hidden="true"
            class="pointer-events-none absolute inset-y-1 left-0 rounded-lg bg-primary-warm-white transition-[translate,width] duration-300 ease-out"
            :style="{
              width: `${pill.width}px`,
              translate: `${pill.left}px 0`
            }"
          />
          <TabsTrigger
            v-for="tab in TABS"
            :key="tab.key"
            :value="tab.key"
            :aria-label="labels[tab.labelKey]"
            :data-testid="`hub-tab-${tab.key}`"
            class="group text-content-muted hover:text-content focus-visible:ring-brand focus-visible:ring-offset-page data-[state=active]:text-page relative z-10 inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap transition-colors outline-none hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-offset-1 sm:px-3.5"
          >
            <component
              :is="tab.icon"
              class="size-3.5 shrink-0"
              aria-hidden="true"
            />
            <!-- Below lg the row runs out of width, so the tabs keep the icon
              and drop the word; the trigger's aria-label still names it. -->
            <span class="ppformula-text-center-sm max-lg:hidden">
              {{ labels[tab.labelKey] }}
            </span>
          </TabsTrigger>
        </TabsList>
      </TabsRoot>

      <div class="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
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

    <!-- A dropdown anchored to a crowded toolbar leaves a phone no room, so
      there the panel rises from the bottom of the screen instead. -->
    <Teleport to="body" :disabled="!isPhone">
      <div
        v-if="filterOpen"
        class="fixed inset-0 z-30 bg-black/60 sm:hidden"
        data-testid="hub-filter-backdrop"
        @click="filterOpen = false"
      />

      <div
        v-if="filterOpen"
        ref="panel"
        class="bg-site-dropdown z-40 flex scrollbar-thin flex-col gap-7 overflow-y-auto border border-white/10 shadow-2xl max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[85vh] max-sm:gap-4 max-sm:rounded-t-3xl max-sm:p-5 sm:absolute sm:top-full sm:right-0 sm:mt-3 sm:max-h-[75vh] sm:w-full sm:max-w-4xl sm:rounded-3xl sm:p-8"
        data-testid="hub-filter-menu"
      >
        <span
          class="mx-auto -mb-4 h-1 w-10 shrink-0 rounded-full bg-white/20 sm:hidden"
          aria-hidden="true"
        />

        <div
          class="-mx-5 flex flex-col sm:hidden"
          data-testid="hub-filter-phone"
        >
          <div
            class="flex scrollbar-hide items-center gap-1 overflow-x-auto border-b border-white/10 p-2"
            role="tablist"
          >
            <button
              v-for="tab in facetTabs"
              :key="tab.key"
              type="button"
              role="tab"
              :aria-selected="currentFacet === tab.key"
              :data-testid="`hub-phone-facet-${tab.key}`"
              :class="
                cn(
                  'cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold tracking-wider whitespace-nowrap uppercase transition-colors',
                  currentFacet === tab.key
                    ? 'text-content bg-white/8'
                    : 'text-content-secondary'
                )
              "
              @click="phoneFacet = tab.key"
            >
              {{ tab.label }}
            </button>
          </div>

          <div v-if="currentGroup" class="border-b border-white/10 p-2">
            <input
              v-model="facetSearch[currentFacet]"
              type="search"
              :placeholder="labels.searchPlaceholder"
              :aria-label="labels.searchPlaceholder"
              class="text-content placeholder:text-content-muted focus-visible:ring-brand w-full rounded-lg bg-white/5 px-3 py-2 text-xs outline-none focus-visible:ring-2 [&::-webkit-search-cancel-button]:hidden"
            />
          </div>

          <ul
            class="max-h-72 scrollbar-thin overflow-y-auto py-1"
            role="listbox"
            aria-multiselectable="true"
          >
            <li v-for="option in phoneOptions" :key="option.value" role="none">
              <button
                type="button"
                role="option"
                :aria-selected="isPhoneChosen(option.value)"
                class="text-content-secondary flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors outline-none hover:bg-white/5"
                @click="phoneToggle(option.value)"
              >
                <span
                  :class="
                    cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors',
                      isPhoneChosen(option.value)
                        ? 'border-brand bg-brand text-page'
                        : 'border-white/25'
                    )
                  "
                  aria-hidden="true"
                >
                  <Check
                    v-if="isPhoneChosen(option.value)"
                    class="size-3"
                    :stroke-width="3"
                  />
                </span>
                <span class="flex-1 truncate">{{ option.label }}</span>
                <span class="text-content/30 shrink-0 tabular-nums">
                  {{ option.count }}
                </span>
              </button>
            </li>
            <li
              v-if="phoneOptions.length === 0"
              role="none"
              class="text-content-muted px-3 py-2 text-xs"
            >
              {{ labels.noResults }}
            </li>
          </ul>
        </div>

        <div class="hidden flex-wrap gap-x-12 gap-y-7 sm:flex">
          <div
            v-for="group in groups.filter((g) => g.display === 'segmented')"
            :key="group.key"
            class="flex flex-col gap-3"
          >
            <h3 :class="groupTitleClass">{{ groupLabel(group) }}</h3>
            <div
              class="flex w-fit flex-wrap items-center gap-1 rounded-full border border-white/15 p-1"
              role="listbox"
              :data-testid="`hub-facet-${group.key}`"
            >
              <button
                type="button"
                role="option"
                :aria-selected="activeCountForType(group.type) === 0"
                :class="segmentClass(activeCountForType(group.type) === 0)"
                :data-testid="`hub-facet-${group.key}-all`"
                @click="store.clearBadgesOfType(group.type)"
              >
                {{ labels.typeAll }}
              </button>
              <button
                v-for="val in group.values"
                :key="val.value"
                type="button"
                role="option"
                :aria-selected="isBadgeActive(group.type, val.value)"
                :class="segmentClass(isBadgeActive(group.type, val.value))"
                @click="
                  store.selectBadge({ type: group.type, value: val.value })
                "
              >
                {{ val.displayValue }}
              </button>
            </div>
          </div>
        </div>

        <div
          v-for="group in groups.filter((g) => g.display === 'chips')"
          :key="group.key"
          class="flex flex-col gap-3 max-sm:hidden"
        >
          <h3 :class="groupTitleClass">{{ groupLabel(group) }}</h3>
          <div
            class="flex flex-wrap items-center gap-3"
            role="listbox"
            aria-multiselectable="true"
            :data-testid="`hub-facet-${group.key}`"
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
              <X
                v-if="isBadgeActive(group.type, val.value)"
                class="size-3.5"
                aria-hidden="true"
              />
            </button>

            <button
              v-if="hiddenCount(group) > 0 || expanded[group.key]"
              type="button"
              class="text-brand hover:text-brand/80 focus-visible:ring-brand inline-flex cursor-pointer items-center gap-1.5 rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2"
              :data-testid="`hub-facet-more-${group.key}`"
              @click="expanded[group.key] = !expanded[group.key]"
            >
              {{ expanded[group.key] ? labels.less : group.allLabel }}
              <ArrowRight
                v-if="!expanded[group.key]"
                class="size-4"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        <div class="hidden gap-7 sm:grid sm:grid-cols-2">
          <div
            v-for="group in groups.filter((g) => g.display === 'select')"
            :key="group.key"
            class="flex flex-col gap-3"
          >
            <h3 :class="groupTitleClass">{{ group.label }}</h3>
            <PopoverRoot
              :open="expanded[group.key] === true"
              @update:open="expanded[group.key] = $event"
            >
              <PopoverTrigger as-child>
                <button
                  type="button"
                  class="focus-visible:ring-brand flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/15 px-5 py-3.5 text-left text-base transition-colors outline-none hover:border-white/30 focus-visible:ring-2"
                  :data-testid="`hub-facet-${group.key}`"
                >
                  <span
                    :class="
                      activeCountForType(group.type) > 0
                        ? 'text-brand'
                        : 'text-content'
                    "
                  >
                    {{ selectLabel(group) }}
                  </span>
                  <ChevronDown
                    :class="
                      cn(
                        'text-content-muted size-4 transition-transform',
                        expanded[group.key] && 'rotate-180'
                      )
                    "
                    aria-hidden="true"
                  />
                </button>
              </PopoverTrigger>

              <PopoverPortal>
                <PopoverContent
                  align="start"
                  :side-offset="8"
                  class="bg-site-dropdown z-50 flex w-(--reka-popover-trigger-width) flex-col gap-3 rounded-2xl border border-white/10 p-4 shadow-2xl"
                >
                  <input
                    v-if="group.values.length > SEARCH_THRESHOLD"
                    v-model="facetSearch[group.key]"
                    type="search"
                    :placeholder="labels.searchPlaceholder"
                    :data-testid="`hub-facet-search-${group.key}`"
                    class="text-content placeholder:text-content-muted focus-visible:ring-brand w-full rounded-xl bg-white/5 px-4 py-2.5 text-sm outline-none focus-visible:ring-2 [&::-webkit-search-cancel-button]:hidden"
                  />
                  <div
                    class="flex max-h-64 scrollbar-thin flex-wrap content-start gap-2 overflow-y-auto"
                    role="listbox"
                    aria-multiselectable="true"
                  >
                    <button
                      v-for="val in matchingValues(group)"
                      :key="val.value"
                      type="button"
                      role="option"
                      :aria-selected="isBadgeActive(group.type, val.value)"
                      :class="chipClass(isBadgeActive(group.type, val.value))"
                      @click="
                        store.toggleBadge({
                          type: group.type,
                          value: val.value
                        })
                      "
                    >
                      {{ val.displayValue }}
                    </button>
                    <p
                      v-if="matchingValues(group).length === 0"
                      class="text-content-muted py-1 text-sm"
                    >
                      {{ labels.noResults }}
                    </p>
                  </div>
                </PopoverContent>
              </PopoverPortal>
            </PopoverRoot>
          </div>
        </div>

        <div
          class="flex items-center justify-between gap-4 border-t border-white/10 pt-6 max-sm:pt-5"
        >
          <button
            type="button"
            class="text-content-secondary hover:text-content shrink-0 cursor-pointer rounded-lg text-base whitespace-nowrap transition-colors max-sm:text-sm"
            data-testid="hub-filter-clear"
            @click="store.clearBadges()"
          >
            {{ labels.clearAll }}
          </button>
          <button
            type="button"
            class="bg-brand text-page hover:bg-brand/90 focus-visible:ring-brand cursor-pointer rounded-full px-8 py-3.5 text-base font-bold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 max-sm:flex-1 max-sm:px-4 max-sm:py-3 max-sm:text-sm"
            data-testid="hub-filter-show"
            @click="filterOpen = false"
          >
            {{ labels.showResults.replace('{n}', String(resultCount)) }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
