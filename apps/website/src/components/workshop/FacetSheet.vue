<script setup lang="ts">
import { Check, X } from '@lucide/vue'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { computed, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

interface FacetSheetOption {
  readonly value: string
  readonly label: string
  readonly count: number
}

export interface FacetSheetGroup {
  readonly key: string
  readonly label: string
  readonly options: readonly FacetSheetOption[]
  readonly selected: readonly string[]
}

interface FacetSheetLabels {
  readonly title: string
  readonly search: string
  readonly noMatches: string
  /** Carries {n}. */
  readonly applied: string
  readonly clearAll: string
  /** Carries {n}. */
  readonly show: string
  readonly close: string
}

// One facet picker for the whole prototype. Both catalogues narrow the same
// way on a phone, so the tabs, the rows, the empty state and the way out are
// decided here once rather than in each listing.
const { groups, labels, resultCount } = defineProps<{
  groups: readonly FacetSheetGroup[]
  labels: FacetSheetLabels
  /** What the catalogue holds under the current choices, for the way out. */
  resultCount: number
}>()

const emit = defineEmits<{
  toggle: [group: string, value: string]
  clearAll: []
  close: []
}>()

const activeKey = ref(groups[0]?.key ?? '')
const search = ref<Record<string, string>>({})

// A facet that is no longer offered would leave the sheet on an empty tab.
watch(
  () => groups.map((group) => group.key).join(),
  () => {
    if (!groups.some((group) => group.key === activeKey.value))
      activeKey.value = groups[0]?.key ?? ''
  }
)

const selectedCount = computed(() =>
  groups.reduce((total, group) => total + group.selected.length, 0)
)

function visibleOptions(group: FacetSheetGroup) {
  const needle = (search.value[group.key] ?? '').trim().toLowerCase()
  return needle
    ? group.options.filter((option) =>
        option.label.toLowerCase().includes(needle)
      )
    : group.options
}
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <span
      class="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20 sm:hidden"
      aria-hidden="true"
    />

    <div class="flex items-center justify-between p-3 pb-1 sm:hidden">
      <h2 class="text-content text-base font-bold">{{ labels.title }}</h2>
      <button
        type="button"
        :aria-label="labels.close"
        class="text-content-secondary hover:text-content grid size-9 cursor-pointer place-items-center rounded-xl bg-white/8"
        data-testid="workshop-filter-close"
        @click="emit('close')"
      >
        <X class="size-4" aria-hidden="true" />
      </button>
    </div>

    <TabsRoot v-model="activeKey" class="flex min-h-0 flex-col">
      <TabsList
        class="flex scrollbar-hide items-center gap-1 overflow-x-auto border-b border-white/10 p-2"
      >
        <TabsTrigger
          v-for="group in groups"
          :key="group.key"
          :value="group.key"
          :data-testid="`workshop-facet-${group.key}`"
          class="text-content-secondary hover:text-content focus-visible:ring-brand data-[state=active]:text-content inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold tracking-wider whitespace-nowrap uppercase transition-colors outline-none hover:bg-white/5 focus-visible:ring-2 data-[state=active]:bg-white/8"
        >
          {{ group.label }}
          <span
            v-if="group.selected.length"
            class="bg-brand text-page inline-flex size-4 items-center justify-center rounded-full text-2xs font-bold tabular-nums"
            :data-testid="`workshop-facet-${group.key}-count`"
          >
            {{ group.selected.length }}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent
        v-for="group in groups"
        :key="group.key"
        :value="group.key"
        class="flex min-h-0 flex-col outline-none"
      >
        <div class="border-b border-white/10 p-2">
          <input
            v-model="search[group.key]"
            type="search"
            :placeholder="labels.search"
            :aria-label="labels.search"
            :data-testid="`workshop-filter-${group.key}-search`"
            class="text-content placeholder:text-content-muted focus-visible:ring-brand w-full rounded-lg bg-white/5 px-3 py-2 text-xs outline-none focus-visible:ring-2 max-sm:py-2.5 max-sm:text-base [&::-webkit-search-cancel-button]:hidden"
          />
        </div>

        <!-- One height whatever the facet holds, so switching tab does not
          resize the sheet under the thumb. -->
        <ul
          class="h-72 scrollbar-thin overflow-y-auto py-1"
          :aria-label="group.label"
        >
          <li v-for="option in visibleOptions(group)" :key="option.value">
            <button
              type="button"
              :aria-pressed="group.selected.includes(option.value)"
              :data-testid="`filter-${group.key}-${option.value}`"
              class="text-content-secondary hover:text-content flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors outline-none hover:bg-white/5 focus-visible:bg-white/5 max-sm:py-2.5 max-sm:text-sm"
              @click="emit('toggle', group.key, option.value)"
            >
              <span
                :class="
                  cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors',
                    group.selected.includes(option.value)
                      ? 'border-brand bg-brand text-page'
                      : 'border-white/25'
                  )
                "
                aria-hidden="true"
              >
                <Check
                  v-if="group.selected.includes(option.value)"
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
            v-if="!visibleOptions(group).length"
            class="text-content-muted px-3 py-2 text-xs max-sm:py-10 max-sm:text-center max-sm:text-sm"
          >
            {{ labels.noMatches }}
          </li>
        </ul>
      </TabsContent>
    </TabsRoot>

    <div
      v-if="selectedCount"
      class="flex items-center justify-between gap-3 border-t border-white/10 p-2 max-sm:hidden"
    >
      <span
        class="text-content-secondary px-1 text-xs"
        data-testid="workshop-filter-applied"
      >
        {{ labels.applied.replace('{n}', String(selectedCount)) }}
      </span>
      <button
        type="button"
        data-testid="workshop-filter-clear"
        class="text-content-secondary hover:text-content cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/5"
        @click="emit('clearAll')"
      >
        {{ labels.clearAll }}
      </button>
    </div>

    <!-- The sheet applies as you tap, so its button is a way out that says
      what is waiting behind it. -->
    <div
      class="flex items-center gap-3 border-t border-white/10 p-3 sm:hidden"
      data-testid="workshop-filter-footer"
    >
      <button
        v-if="selectedCount"
        type="button"
        data-testid="workshop-filter-sheet-clear"
        class="shrink-0 cursor-pointer px-2 text-sm text-primary-warm-gray hover:text-primary-warm-white"
        @click="emit('clearAll')"
      >
        {{ labels.clearAll }}
      </button>
      <button
        type="button"
        class="bg-primary-comfy-yellow hover:bg-primary-comfy-yellow/90 h-11 flex-1 cursor-pointer rounded-2xl text-sm font-bold text-primary-comfy-ink"
        data-testid="workshop-filter-show"
        @click="resultCount > 0 ? emit('close') : emit('clearAll')"
      >
        {{
          resultCount > 0
            ? labels.show.replace('{n}', String(resultCount))
            : labels.clearAll
        }}
      </button>
    </div>
  </div>
</template>
