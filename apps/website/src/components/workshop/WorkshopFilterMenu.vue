<script setup lang="ts">
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Search
} from '@lucide/vue'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, nextTick, ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

export interface FacetMenuOption {
  readonly value: string
  readonly label: string
  readonly count: number
}

type Facet = 'capability' | 'provider'

const {
  capabilityOptions,
  providerOptions,
  locale = 'en'
} = defineProps<{
  capabilityOptions: readonly FacetMenuOption[]
  providerOptions: readonly FacetMenuOption[]
  locale?: Locale
}>()

const capabilities = defineModel<string[]>('capabilities', { required: true })
const providers = defineModel<string[]>('providers', { required: true })

const section = ref<Facet | 'root'>('root')
const query = ref('')
const searchBox = useTemplateRef<HTMLInputElement>('searchBox')

// Switching sections unmounts the focused row; the menu would read that as
// focus leaving and close, so focus moves to the search box instead.
async function show(next: Facet | 'root') {
  section.value = next
  query.value = ''
  await nextTick()
  searchBox.value?.focus()
}

const facets = computed(() => [
  {
    facet: 'capability' as const,
    label: t('workshop.filter.capabilityGroup', locale),
    options: capabilityOptions,
    selected: capabilities
  },
  {
    facet: 'provider' as const,
    label: t('workshop.filter.providerGroup', locale),
    options: providerOptions,
    selected: providers
  }
])

const selectedCount = computed(
  () => capabilities.value.length + providers.value.length
)

const needle = computed(() => query.value.trim().toLowerCase())

function matches(option: FacetMenuOption) {
  return !needle.value || option.label.toLowerCase().includes(needle.value)
}

// While typing at the root, every facet lists its matches inline; inside a
// facet the same box narrows that facet only.
const visibleFacets = computed(() =>
  facets.value
    .filter(({ facet }) => section.value === 'root' || section.value === facet)
    .map((entry) => ({ ...entry, options: entry.options.filter(matches) }))
    .filter(({ options }) => options.length > 0)
)

function toggle(facet: Facet, value: string) {
  const selected = facet === 'capability' ? capabilities : providers
  selected.value = selected.value.includes(value)
    ? selected.value.filter((item) => item !== value)
    : [...selected.value, value]
}

const open = (facet: Facet) => show(facet)
const back = () => show('root')

function clearAll() {
  capabilities.value = []
  providers.value = []
}

// The menu's typeahead must not swallow typing, but Escape still closes it.
function stopTypeaheadKeys(event: KeyboardEvent) {
  if (event.key !== 'Escape') event.stopPropagation()
}

const itemClass =
  'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-primary-comfy-canvas outline-none select-none data-[highlighted]:bg-transparency-white-t8'
const sectionLabelClass =
  'px-3 pt-2 pb-1 text-[11px] font-bold tracking-wider text-primary-warm-gray uppercase'
</script>

<template>
  <DropdownMenuRoot @update:open="(isOpen) => !isOpen && back()">
    <DropdownMenuTrigger
      data-testid="workshop-filter"
      :class="
        cn(
          'hover:bg-transparency-white-t4 focus-visible:ring-primary-comfy-yellow/50 inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3',
          selectedCount
            ? 'border-primary-comfy-yellow text-primary-warm-white'
            : 'border-transparency-white-t20 text-primary-comfy-canvas'
        )
      "
    >
      <ListFilter class="size-4" aria-hidden="true" />
      {{ t('workshop.filter.label', locale) }}
      <span
        v-if="selectedCount"
        class="bg-primary-comfy-yellow rounded-full px-1.5 text-[10px] font-bold text-primary-comfy-ink"
        data-testid="workshop-filter-count"
      >
        {{ selectedCount }}
      </span>
      <ChevronDown class="size-4" aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="8"
        class="border-primary-comfy-ink-light bg-site-dropdown z-50 flex max-h-[min(28rem,var(--reka-dropdown-menu-content-available-height))] w-72 flex-col rounded-2xl border p-2 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        data-testid="workshop-filter-menu"
      >
        <div
          class="relative -mx-2 -mt-2 mb-1 border-b border-transparency-white-t8"
        >
          <Search
            class="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary-warm-gray"
            aria-hidden="true"
          />
          <input
            ref="searchBox"
            v-model="query"
            type="search"
            :placeholder="t('workshop.filter.filterBy', locale)"
            :aria-label="t('workshop.filter.filterBy', locale)"
            :data-testid="
              section === 'root'
                ? 'workshop-filter-search'
                : `workshop-filter-${section}-search`
            "
            class="h-12 w-full bg-transparent pr-4 pl-11 text-sm text-primary-warm-white outline-none placeholder:text-primary-warm-gray [&::-webkit-search-cancel-button]:hidden"
            @keydown="stopTypeaheadKeys"
          />
        </div>

        <template v-if="section === 'root' && !needle">
          <p :class="sectionLabelClass">
            {{ t('workshop.filter.sectionLabel', locale) }}
          </p>
          <DropdownMenuItem
            v-for="entry in facets"
            :key="entry.facet"
            :class="itemClass"
            :data-testid="`workshop-filter-${entry.facet}`"
            @select.prevent="open(entry.facet)"
          >
            <span class="flex-1">{{ entry.label }}</span>
            <span
              v-if="entry.selected.value.length"
              class="bg-primary-comfy-yellow rounded-full px-1.5 text-[10px] font-bold text-primary-comfy-ink"
              :data-testid="`workshop-filter-${entry.facet}-count`"
            >
              {{ entry.selected.value.length }}
            </span>
            <ChevronRight
              class="size-4 text-primary-warm-gray"
              aria-hidden="true"
            />
          </DropdownMenuItem>
        </template>

        <template v-else>
          <DropdownMenuItem
            v-if="section !== 'root'"
            :class="cn(itemClass, 'text-primary-warm-gray')"
            data-testid="workshop-filter-back"
            @select.prevent="back"
          >
            <ChevronLeft class="size-4" aria-hidden="true" />
            {{ t('workshop.filter.back', locale) }}
          </DropdownMenuItem>
          <div class="min-h-0 overflow-y-auto">
            <template v-for="entry in visibleFacets" :key="entry.facet">
              <p :class="sectionLabelClass">{{ entry.label }}</p>
              <DropdownMenuCheckboxItem
                v-for="option in entry.options"
                :key="option.value"
                :model-value="entry.selected.value.includes(option.value)"
                :data-testid="`filter-${entry.facet}-${option.value}`"
                :class="itemClass"
                @select.prevent
                @update:model-value="toggle(entry.facet, option.value)"
              >
                <span
                  :class="
                    cn(
                      'grid size-4 shrink-0 place-items-center rounded-sm border',
                      entry.selected.value.includes(option.value)
                        ? 'border-primary-comfy-yellow bg-primary-comfy-yellow text-primary-comfy-ink'
                        : 'border-transparency-white-t20'
                    )
                  "
                >
                  <Check
                    v-if="entry.selected.value.includes(option.value)"
                    class="size-3"
                    aria-hidden="true"
                  />
                </span>
                <span class="flex-1">{{ option.label }}</span>
                <span class="text-primary-warm-gray">{{ option.count }}</span>
              </DropdownMenuCheckboxItem>
            </template>
            <p
              v-if="!visibleFacets.length"
              class="px-3 py-2 text-sm text-primary-warm-gray"
            >
              {{ t('workshop.filter.noMatches', locale) }}
            </p>
          </div>
        </template>

        <template v-if="selectedCount">
          <DropdownMenuSeparator class="my-2 h-px bg-transparency-white-t8" />
          <DropdownMenuItem
            :class="cn(itemClass, 'text-primary-warm-gray')"
            data-testid="workshop-filter-clear"
            @select="clearAll"
          >
            {{ t('workshop.filter.clearAll', locale) }}
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
