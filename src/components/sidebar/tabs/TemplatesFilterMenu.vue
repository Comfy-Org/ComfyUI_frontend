<template>
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
      :placeholder="$t('g.search')"
      class="min-w-0 flex-1 border-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      @keydown="handleSearchKeydown"
    />
  </div>
  <DropdownMenuSeparator class="my-1 h-px bg-border-subtle" />

  <!-- Searching cuts across every facet at once: with a hundred-odd models,
       finding one by name beats remembering which facet it lives in. -->
  <template v-if="isSearching">
    <template v-for="group in searchResults" :key="group.facet.key">
      <DropdownMenuLabel v-if="group.options.length" :class="groupLabelClass">
        {{ group.facet.label }}
      </DropdownMenuLabel>
      <component
        :is="
          group.facet.mode === 'single'
            ? DropdownMenuRadioItem
            : DropdownMenuCheckboxItem
        "
        v-for="option in group.options"
        :key="`${group.facet.key}:${option.value}`"
        v-bind="itemBindings(group.facet, option)"
        data-templates-filter-result
        :class="menuItemClass"
        @click="emit('toggle', group.facet.key, option.value)"
        @keydown="handleSearchResultKeydown"
        @select.prevent
      >
        <span
          v-if="group.facet.mode === 'multiple'"
          :class="
            cn(
              'flex size-4 shrink-0 items-center justify-center rounded-sm transition-colors duration-200',
              group.facet.selectedValues.includes(option.value)
                ? 'bg-primary-background'
                : 'bg-secondary-background'
            )
          "
        >
          <i
            v-if="group.facet.selectedValues.includes(option.value)"
            class="icon-[lucide--check] text-xs font-bold text-base-foreground"
          />
        </span>
        <span class="flex-1">{{ option.name }}</span>
        <DropdownMenuItemIndicator
          v-if="group.facet.mode === 'single'"
          class="size-4 shrink-0"
        >
          <i class="icon-[lucide--check]" />
        </DropdownMenuItemIndicator>
      </component>
    </template>

    <div
      v-if="!hasSearchResults"
      class="px-2 py-1.5 text-sm text-muted-foreground"
    >
      {{ $t('g.noResultsFound') }}
    </div>
  </template>

  <template v-else>
    <DropdownMenuSub v-for="facet in facets" :key="facet.key">
      <DropdownMenuSubTrigger
        :class="menuItemClass"
        :data-testid="`template-filter-facet-${facet.key}`"
      >
        <i :class="cn(facet.icon, 'size-4 shrink-0 text-muted-foreground')" />
        <span class="flex-1 text-left">{{ facet.label }}</span>
        <span v-if="selectedCount(facet)" class="text-xs text-muted-foreground">
          {{ selectedCount(facet) }}
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
          <!-- Single-select facets are a radio group so only one can be on;
               everything else is a checkbox list that survives each pick. -->
          <DropdownMenuRadioGroup
            v-if="facet.mode === 'single'"
            :model-value="facet.selectedValues[0]"
          >
            <DropdownMenuRadioItem
              v-for="option in facet.options"
              :key="option.value"
              :value="option.value"
              :class="menuItemClass"
              @click="emit('toggle', facet.key, option.value)"
              @select.prevent
            >
              <span class="flex-1">{{ option.name }}</span>
              <DropdownMenuItemIndicator class="size-4 shrink-0">
                <i class="icon-[lucide--check]" />
              </DropdownMenuItemIndicator>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          <template v-else>
            <DropdownMenuCheckboxItem
              v-for="option in facet.options"
              :key="option.value"
              :model-value="facet.selectedValues.includes(option.value)"
              :class="menuItemClass"
              @click="emit('toggle', facet.key, option.value)"
              @select.prevent
            >
              <span
                :class="
                  cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-sm transition-colors duration-200',
                    facet.selectedValues.includes(option.value)
                      ? 'bg-primary-background'
                      : 'bg-secondary-background'
                  )
                "
              >
                <i
                  v-if="facet.selectedValues.includes(option.value)"
                  class="icon-[lucide--check] text-xs font-bold text-base-foreground"
                />
              </span>
              <span class="flex-1">{{ option.name }}</span>
            </DropdownMenuCheckboxItem>
          </template>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  </template>
</template>

<script setup lang="ts">
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from 'reka-ui'
import { computed, nextTick, onMounted, ref } from 'vue'

import type { SelectOption } from '@/components/ui/select/types'
import { cn } from '@comfyorg/tailwind-utils'

/**
 * Templates filter menu, built on the same primitives as the Media Assets
 * filter (#14166): nested submenus with Reka handling placement and collision,
 * checkbox items that keep the menu open, and a root search that cuts across
 * every facet.
 */
export interface FilterMenuFacet {
  key: string
  label: string
  icon: string
  options: SelectOption[]
  selectedValues: string[]
  /** Multi-select is the default; single-select facets use a radio group. */
  mode: 'single' | 'multiple'
  /** Value that counts as "nothing chosen" for single-select facets. */
  emptyValue?: string
}

const { facets } = defineProps<{ facets: FilterMenuFacet[] }>()

const emit = defineEmits<{
  toggle: [facetKey: string, value: string]
}>()

const searchInput = ref<HTMLInputElement>()
const searchQuery = ref('')
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

function selectedCount(facet: FilterMenuFacet) {
  return facet.selectedValues.filter((value) => value !== facet.emptyValue)
    .length
}

/** Radio items key off `value`, checkbox items off `modelValue`. */
function itemBindings(facet: FilterMenuFacet, option: SelectOption) {
  return facet.mode === 'single'
    ? { value: option.value }
    : { modelValue: facet.selectedValues.includes(option.value) }
}

const menuItemClass =
  'flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm outline-none data-highlighted:bg-secondary-background-hover'
const groupLabelClass =
  'px-2 pt-1 pb-1.5 text-xs font-semibold text-muted-foreground uppercase'
const submenuClass =
  'z-1700 max-h-80 min-w-40 overflow-y-auto scrollbar-custom rounded-lg border border-border-subtle bg-base-background p-2 shadow-sm'

onMounted(() => {
  void nextTick(() => searchInput.value?.focus())
})

function getSearchResults() {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-templates-filter-result]')
  )
}

function handleSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const results = getSearchResults()
    const result = event.key === 'ArrowDown' ? results.at(0) : results.at(-1)
    if (result) {
      event.preventDefault()
      event.stopPropagation()
      result.focus()
    }
  }
}

/** Typing keeps working while the keyboard is down in the result list. */
function handleSearchResultKeydown(event: KeyboardEvent) {
  if (event.key.length === 1 || event.key === 'Backspace') {
    event.stopPropagation()
    searchInput.value?.focus()
  }
}
</script>
