<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'

import type { SelectOption } from '@/components/ui/select/types'
import { cn } from '@comfyorg/tailwind-utils'

/**
 * Linear-style filter menu (Pablo, 08-05: "we are standardizing to this UX"),
 * built on the shadcn Command pattern the design system already uses for
 * MultiSelect: one searchable list that drills from "which facet" into "which
 * values", instead of every facet's options being on screen at once.
 */
export interface FilterMenuFacet {
  key: string
  label: string
  icon: string
  options: SelectOption[]
  selectedValues: string[]
  /** Single-select facets show a tick; multi-select ones show checkboxes. */
  mode: 'single' | 'multiple'
  /** Value that counts as "nothing chosen" for single-select facets. */
  emptyValue?: string
}

const { facets } = defineProps<{ facets: FilterMenuFacet[] }>()

const emit = defineEmits<{
  toggle: [facetKey: string, value: string]
  clearAll: []
}>()

const openFacetKey = ref<string | null>(null)
const query = ref('')
const searchRef = useTemplateRef<HTMLInputElement>('searchRef')

const openFacet = computed(
  () => facets.find((f) => f.key === openFacetKey.value) ?? null
)

const activeCount = computed(() =>
  facets.reduce((total, facet) => total + selectedCount(facet), 0)
)

function selectedCount(facet: FilterMenuFacet) {
  return facet.mode === 'single'
    ? facet.selectedValues.filter((v) => v !== facet.emptyValue).length
    : facet.selectedValues.length
}

/** Summary shown next to a facet in the root list. */
function facetSummary(facet: FilterMenuFacet) {
  const chosen = facet.options.filter((o) =>
    facet.selectedValues.includes(o.value)
  )
  if (!chosen.length) return ''
  return chosen.length === 1
    ? chosen[0].name
    : `${chosen[0].name} +${chosen.length - 1}`
}

const visibleFacets = computed(() => {
  const q = query.value.toLowerCase().trim()
  if (!q) return facets
  return facets.filter((f) => f.label.toLowerCase().includes(q))
})

const visibleOptions = computed(() => {
  const facet = openFacet.value
  if (!facet) return []
  const q = query.value.toLowerCase().trim()
  const options = q
    ? facet.options.filter((o) => o.name.toLowerCase().includes(q))
    : facet.options
  // Chosen values first so a long list never hides what's already applied.
  const isOn = (o: SelectOption) => facet.selectedValues.includes(o.value)
  return [...options.filter(isOn), ...options.filter((o) => !isOn(o))]
})

async function enterFacet(key: string) {
  openFacetKey.value = key
  query.value = ''
  await nextTick()
  searchRef.value?.focus()
}

async function backToRoot() {
  openFacetKey.value = null
  query.value = ''
  await nextTick()
  searchRef.value?.focus()
}

function isSelected(facet: FilterMenuFacet, option: SelectOption) {
  return facet.selectedValues.includes(option.value)
}

function onOptionClick(facet: FilterMenuFacet, option: SelectOption) {
  emit('toggle', facet.key, option.value)
  // Single-select is a decision, so it closes the drill-down; multi-select
  // stays put because picking several in a row is the whole point.
  if (facet.mode === 'single') void backToRoot()
}

/** Escape backs out of a facet before it closes the whole menu. */
function onEscape(event: KeyboardEvent) {
  if (openFacetKey.value) {
    event.stopPropagation()
    void backToRoot()
  }
}

// Reopening the menu should always start at the root list.
watch(
  () => facets.length,
  () => {
    if (!facets.some((f) => f.key === openFacetKey.value)) {
      openFacetKey.value = null
    }
  }
)

const rowClass =
  'flex h-9 w-full cursor-pointer items-center gap-2 rounded-md border-none bg-transparent px-2 text-left text-sm text-base-foreground outline-none hover:bg-secondary-background-hover'
</script>

<template>
  <div
    class="flex w-72 flex-col"
    data-testid="template-filter-bar"
    @keydown.escape="onEscape"
  >
    <!-- Command-style search: a full-bleed row with a hairline under it, so
         the panel reads as one aligned column. -->
    <div
      class="-mx-2 -mt-2 mb-1 flex items-center gap-2 border-b border-border-subtle px-3"
    >
      <button
        v-if="openFacet"
        type="button"
        :aria-label="$t('g.back')"
        class="-ml-1 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm border-none bg-transparent text-muted-foreground outline-none hover:text-base-foreground"
        @click="backToRoot"
      >
        <i class="icon-[lucide--chevron-left] size-4" />
      </button>
      <i
        v-else
        class="icon-[lucide--search] size-3.5 shrink-0 text-muted-foreground"
      />
      <input
        ref="searchRef"
        v-model="query"
        :placeholder="openFacet ? openFacet.label : $t('g.search')"
        class="h-10 w-full min-w-0 border-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>

    <div class="flex scrollbar-custom max-h-72 flex-col overflow-y-auto p-1">
      <!-- Root: which facet do you want to filter by? -->
      <template v-if="!openFacet">
        <button
          v-for="facet in visibleFacets"
          :key="facet.key"
          type="button"
          :class="rowClass"
          @click="enterFacet(facet.key)"
        >
          <i :class="cn(facet.icon, 'size-4 shrink-0 text-muted-foreground')" />
          <span class="min-w-0 flex-1 truncate">{{ facet.label }}</span>
          <span
            v-if="facetSummary(facet)"
            class="max-w-28 shrink-0 truncate text-xs text-muted-foreground"
          >
            {{ facetSummary(facet) }}
          </span>
          <i
            class="icon-[lucide--chevron-right] size-4 shrink-0 text-muted-foreground"
          />
        </button>
      </template>

      <!-- Drill-down: which values of that facet? -->
      <template v-else>
        <button
          v-for="option in visibleOptions"
          :key="option.value"
          type="button"
          :class="rowClass"
          @click="onOptionClick(openFacet, option)"
        >
          <span
            v-if="openFacet.mode === 'multiple'"
            :class="
              cn(
                'flex size-4 shrink-0 items-center justify-center rounded-sm transition-colors duration-200',
                isSelected(openFacet, option)
                  ? 'bg-primary-background'
                  : 'bg-secondary-background'
              )
            "
          >
            <i
              v-if="isSelected(openFacet, option)"
              class="icon-[lucide--check] text-xs font-bold text-base-foreground"
            />
          </span>
          <span class="min-w-0 flex-1 truncate">{{ option.name }}</span>
          <i
            v-if="openFacet.mode === 'single' && isSelected(openFacet, option)"
            class="icon-[lucide--check] size-4 shrink-0"
          />
        </button>
      </template>

      <p
        v-if="(openFacet ? visibleOptions : visibleFacets).length === 0"
        class="m-0 px-2 py-3 text-center text-xs text-muted-foreground"
      >
        {{ $t('g.noResultsFound') }}
      </p>
    </div>

    <div
      v-if="!openFacet && activeCount > 0"
      class="-mx-2 mt-1 border-t border-border-subtle px-3 pt-2 pb-1"
    >
      <button
        type="button"
        class="cursor-pointer border-none bg-transparent p-0 text-xs text-muted-foreground underline underline-offset-2 outline-none hover:text-base-foreground"
        @click="emit('clearAll')"
      >
        {{ $t('templateWorkflows.clearAllFilters') }}
      </button>
    </div>
  </div>
</template>
