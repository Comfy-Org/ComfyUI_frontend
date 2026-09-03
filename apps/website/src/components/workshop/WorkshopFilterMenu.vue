<script setup lang="ts">
import { Check, ChevronDown, ListFilter } from '@lucide/vue'
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
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

export interface FacetMenuOption {
  readonly value: string
  readonly label: string
  readonly count: number
}

type Facet = 'provider' | 'capability'

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

const open = ref(false)
const activeFacet = ref<Facet>('provider')
const search = ref<Record<Facet, string>>({ provider: '', capability: '' })

const facets = computed(() => [
  {
    facet: 'provider' as const,
    label: t('workshop.filter.providerGroup', locale),
    options: providerOptions,
    selected: providers
  },
  {
    facet: 'capability' as const,
    label: t('workshop.filter.capabilityGroup', locale),
    options: capabilityOptions,
    selected: capabilities
  }
])

const selectedCount = computed(
  () => capabilities.value.length + providers.value.length
)

function visibleOptions(entry: (typeof facets.value)[number]) {
  const needle = search.value[entry.facet].trim().toLowerCase()
  return needle
    ? entry.options.filter((option) =>
        option.label.toLowerCase().includes(needle)
      )
    : entry.options
}

function toggle(facet: Facet, value: string) {
  const selected = facet === 'capability' ? capabilities : providers
  selected.value = selected.value.includes(value)
    ? selected.value.filter((item) => item !== value)
    : [...selected.value, value]
}

function clearAll() {
  capabilities.value = []
  providers.value = []
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger
      data-testid="workshop-filter"
      :class="
        cn(
          'hover:bg-transparency-white-t4 focus-visible:ring-primary-comfy-yellow/50 inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3',
          'border-transparency-white-t20',
          selectedCount
            ? 'text-primary-warm-white'
            : 'text-primary-comfy-canvas'
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
      <ChevronDown
        :class="cn('size-4 transition-transform', open && 'rotate-180')"
        aria-hidden="true"
      />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        align="end"
        :side-offset="8"
        data-testid="workshop-filter-menu"
        class="bg-site-dropdown z-50 w-80 max-w-[calc(100vw-2rem)] max-h-[var(--reka-popover-content-available-height)] overflow-y-auto rounded-2xl border border-white/10 shadow-2xl shadow-black/50 outline-none"
      >
        <TabsRoot v-model="activeFacet" class="flex flex-col">
          <TabsList
            class="flex items-center gap-1 border-b border-white/10 p-2"
          >
            <TabsTrigger
              v-for="entry in facets"
              :key="entry.facet"
              :value="entry.facet"
              :data-testid="`workshop-facet-${entry.facet}`"
              class="text-content-secondary hover:text-content focus-visible:ring-brand data-[state=active]:text-content inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wider whitespace-nowrap uppercase transition-colors outline-none hover:bg-white/5 focus-visible:ring-2 data-[state=active]:bg-white/8"
            >
              {{ entry.label }}
              <span
                v-if="entry.selected.value.length"
                class="bg-brand text-page inline-flex min-w-4 items-center justify-center rounded-full px-1 text-2xs font-bold tabular-nums"
                :data-testid="`workshop-facet-${entry.facet}-count`"
              >
                {{ entry.selected.value.length }}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent
            v-for="entry in facets"
            :key="entry.facet"
            :value="entry.facet"
            class="flex flex-col outline-none"
          >
            <div class="border-b border-white/10 p-2">
              <input
                v-model="search[entry.facet]"
                type="search"
                :placeholder="t('workshop.filter.search', locale)"
                :aria-label="t('workshop.filter.search', locale)"
                :data-testid="`workshop-filter-${entry.facet}-search`"
                class="text-content placeholder:text-content-muted focus-visible:ring-brand w-full rounded-lg bg-white/5 px-3 py-2 text-xs outline-none focus-visible:ring-2 [&::-webkit-search-cancel-button]:hidden"
              />
            </div>
            <ul
              class="max-h-72 scrollbar-thin overflow-y-auto py-1"
              role="listbox"
              aria-multiselectable="true"
            >
              <li
                v-for="option in visibleOptions(entry)"
                :key="option.value"
                role="none"
              >
                <button
                  type="button"
                  role="option"
                  :aria-selected="entry.selected.value.includes(option.value)"
                  :data-testid="`filter-${entry.facet}-${option.value}`"
                  class="text-content-secondary hover:text-content flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors outline-none hover:bg-white/5 focus-visible:bg-white/5"
                  @click="toggle(entry.facet, option.value)"
                >
                  <span
                    :class="
                      cn(
                        'flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors',
                        entry.selected.value.includes(option.value)
                          ? 'border-brand bg-brand text-page'
                          : 'border-white/25'
                      )
                    "
                    aria-hidden="true"
                  >
                    <Check
                      v-if="entry.selected.value.includes(option.value)"
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
                v-if="!visibleOptions(entry).length"
                class="text-content-muted px-3 py-2 text-xs"
              >
                {{ t('workshop.filter.noMatches', locale) }}
              </li>
            </ul>
          </TabsContent>
        </TabsRoot>

        <div
          v-if="selectedCount"
          class="flex items-center justify-between gap-3 border-t border-white/10 p-2"
        >
          <span
            class="text-content-secondary px-1 text-xs"
            data-testid="workshop-filter-applied"
          >
            {{
              t('workshop.filter.applied', locale).replace(
                '{n}',
                String(selectedCount)
              )
            }}
          </span>
          <button
            type="button"
            data-testid="workshop-filter-clear"
            class="text-content-secondary hover:text-content cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/5"
            @click="clearAll"
          >
            {{ t('workshop.filter.clearAll', locale) }}
          </button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
