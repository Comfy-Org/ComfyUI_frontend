<template>
  <div>
    <div class="flex h-8 items-center gap-2 px-2">
      <i
        aria-hidden="true"
        class="icon-[lucide--search] size-4 shrink-0 text-muted-foreground"
      />
      <input
        ref="searchInput"
        v-model="searchQuery"
        type="text"
        :aria-label="$t('templateWorkflows.filtersButton')"
        :placeholder="`${$t('templateWorkflows.filtersButton')}...`"
        class="min-w-0 flex-1 border-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        @keydown="handleSearchKeydown"
      />
    </div>
    <DropdownMenuSeparator class="my-1 h-px bg-border-subtle" />

    <!-- Typing searches values across every facet at once: with a hundred-odd
         models, finding one by name beats recalling which facet holds it. -->
    <template v-if="isSearching">
      <template v-for="group in searchResults" :key="group.facet.key">
        <DropdownMenuLabel v-if="group.options.length" :class="groupLabelClass">
          {{ group.facet.label }}
        </DropdownMenuLabel>
        <DropdownMenuItem
          v-for="option in group.options"
          :key="`${group.facet.key}:${option.value}`"
          data-templates-filter-result
          :class="menuItemClass"
          @click="emit('toggle', group.facet.key, option.value)"
          @keydown="handleSearchResultKeydown"
          @select.prevent
        >
          <ValueMark :facet="group.facet" :option="option" />
          <span class="flex-1 truncate">{{ option.name }}</span>
        </DropdownMenuItem>
      </template>

      <div
        v-if="!hasSearchResults"
        class="px-2 py-1.5 text-sm text-muted-foreground"
      >
        {{ $t('g.noResultsFound') }}
      </div>
    </template>

    <template v-else>
      <DropdownMenuSub
        v-for="facet in facets"
        :key="facet.key"
        :open="openSubKey === facet.key"
        @update:open="(open: boolean) => (openSubKey = open ? facet.key : null)"
      >
        <DropdownMenuSubTrigger
          :class="menuItemClass"
          :data-testid="`template-filter-facet-${facet.key}`"
        >
          <i :class="cn(facet.icon, 'size-4 shrink-0 text-muted-foreground')" />
          <span class="flex-1 truncate text-left">{{ facet.label }}</span>
          <span
            v-if="facetSummary(facet)"
            class="max-w-24 shrink-0 truncate text-xs text-muted-foreground"
          >
            {{ facetSummary(facet) }}
          </span>
          <i
            class="icon-[lucide--chevron-right] size-4 shrink-0 text-muted-foreground"
          />
        </DropdownMenuSubTrigger>

        <DropdownMenuPortal>
          <DropdownMenuSubContent
            :side-offset="8"
            :align-offset="-9"
            :collision-padding="10"
            :prioritize-position="false"
            :class="submenuClass"
          >
            <!-- The submenu says what picking here does, so the list isn't a
                 bare column of words once you're two levels deep. -->
            <DropdownMenuLabel :class="groupLabelClass">
              {{ facet.submenuLabel ?? facet.label }}
            </DropdownMenuLabel>

            <div
              v-if="facet.options.length > SEARCHABLE_FROM"
              class="mb-1 flex h-8 items-center gap-2 border-b border-border-subtle px-2"
            >
              <i
                aria-hidden="true"
                class="icon-[lucide--search] size-3.5 shrink-0 text-muted-foreground"
              />
              <input
                v-model="facetQuery[facet.key]"
                type="text"
                :placeholder="facet.label"
                class="min-w-0 flex-1 border-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                @keydown.stop
              />
            </div>

            <div class="scrollbar-custom max-h-64 overflow-y-auto">
              <DropdownMenuItem
                v-for="option in facetOptions(facet)"
                :key="option.value"
                :class="menuItemClass"
                @click="emit('toggle', facet.key, option.value)"
                @select.prevent
              >
                <ValueMark :facet="facet" :option="option" />
                <span class="flex-1 truncate">{{ option.name }}</span>
              </DropdownMenuItem>

              <p
                v-if="facetOptions(facet).length === 0"
                class="m-0 p-2 text-xs text-muted-foreground"
              >
                {{ $t('g.noResultsFound') }}
              </p>
            </div>

            <template v-if="selectedCount(facet) > 0">
              <DropdownMenuSeparator class="my-1 h-px bg-border-subtle" />
              <DropdownMenuItem
                :class="menuItemClass"
                @click="emit('clearFacet', facet.key)"
                @select.prevent
              >
                <i
                  class="icon-[lucide--x] size-4 shrink-0 text-muted-foreground"
                />
                <span class="flex-1">{{ $t('g.clearAll') }}</span>
              </DropdownMenuItem>
            </template>
          </DropdownMenuSubContent>
        </DropdownMenuPortal>
      </DropdownMenuSub>

      <template v-if="totalSelected > 0">
        <DropdownMenuSeparator class="my-1 h-px bg-border-subtle" />
        <DropdownMenuItem
          :class="menuItemClass"
          data-testid="template-filter-clear-all"
          @click="emit('clearAll')"
          @select.prevent
        >
          <i
            class="icon-[lucide--rotate-ccw] size-4 shrink-0 text-muted-foreground"
          />
          <span class="flex-1">{{
            $t('templateWorkflows.clearAllFilters')
          }}</span>
        </DropdownMenuItem>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from 'reka-ui'
import { computed, nextTick, onMounted, ref } from 'vue'

import type { SelectOption } from '@/components/ui/select/types'
import { cn } from '@comfyorg/tailwind-utils'

import ValueMark from './TemplatesFilterValueMark.vue'

/**
 * Filter menu in the shape the reference command menus use: a searchable list
 * of facets, each with a shortcut key and a summary of what it currently
 * holds, opening into its own labelled submenu. Built on the same Reka
 * primitives as the Media Assets filter (#14166) so placement, collision and
 * keyboard traversal come from the library.
 */
export interface FilterMenuFacet {
  key: string
  label: string
  icon: string
  options: SelectOption[]
  selectedValues: string[]
  /** Multi-select is the default; single-select facets show a tick. */
  mode: 'single' | 'multiple'
  /** Value that counts as "nothing chosen" for single-select facets. */
  emptyValue?: string
  /** Overrides the submenu heading when the facet label is too terse. */
  submenuLabel?: string
}

/** Below this many options a search box is more chrome than help. */
const SEARCHABLE_FROM = 8

const { facets } = defineProps<{ facets: FilterMenuFacet[] }>()

const emit = defineEmits<{
  toggle: [facetKey: string, value: string]
  clearFacet: [facetKey: string]
  clearAll: []
}>()

const searchInput = ref<HTMLInputElement>()
const searchQuery = ref('')
const facetQuery = ref<Record<string, string>>({})
const openSubKey = ref<string | null>(null)

const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase())
const isSearching = computed(() => normalizedQuery.value.length > 0)

const searchResults = computed(() =>
  facets.map((facet) => ({
    facet,
    options: facet.options.filter((option) =>
      option.name.toLowerCase().includes(normalizedQuery.value)
    )
  }))
)

const hasSearchResults = computed(() =>
  searchResults.value.some((group) => group.options.length > 0)
)

const totalSelected = computed(() =>
  facets.reduce((total, facet) => total + selectedCount(facet), 0)
)

function selectedCount(facet: FilterMenuFacet) {
  return facet.selectedValues.filter((value) => value !== facet.emptyValue)
    .length
}

/** What this facet currently holds, shown inline so the root list is a status. */
function facetSummary(facet: FilterMenuFacet) {
  const chosen = facet.options.filter((option) =>
    facet.selectedValues.includes(option.value)
  )
  const applied = chosen.filter((option) => option.value !== facet.emptyValue)
  if (!applied.length) return ''
  return applied.length === 1
    ? applied[0].name
    : `${applied[0].name} +${applied.length - 1}`
}

/** Chosen values first, so a long list never buries what is already applied. */
function facetOptions(facet: FilterMenuFacet) {
  const query = (facetQuery.value[facet.key] ?? '').trim().toLowerCase()
  const options = query
    ? facet.options.filter((option) =>
        option.name.toLowerCase().includes(query)
      )
    : facet.options
  const isOn = (option: SelectOption) =>
    facet.selectedValues.includes(option.value) &&
    option.value !== facet.emptyValue
  return [...options.filter(isOn), ...options.filter((o) => !isOn(o))]
}

onMounted(() => {
  void nextTick(() => searchInput.value?.focus())
})

function handleSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const results = Array.from(
      document.querySelectorAll<HTMLElement>('[data-templates-filter-result]')
    )
    const result = event.key === 'ArrowDown' ? results.at(0) : results.at(-1)
    if (result) {
      event.preventDefault()
      event.stopPropagation()
      result.focus()
    }
  }
}

/** Typing keeps editing the query while the keyboard is down in the results. */
function handleSearchResultKeydown(event: KeyboardEvent) {
  if (event.key.length === 1 || event.key === 'Backspace') {
    event.stopPropagation()
    searchInput.value?.focus()
  }
}

const menuItemClass =
  'flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm outline-none data-highlighted:bg-secondary-background-hover'
const groupLabelClass =
  'px-2 pt-1 pb-1.5 text-xs font-semibold text-muted-foreground uppercase'
const submenuClass =
  'z-1700 w-56 rounded-lg border border-border-subtle bg-base-background p-2 shadow-sm'
</script>
