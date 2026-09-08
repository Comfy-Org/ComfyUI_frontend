<script setup lang="ts">
import { Check, ChevronDown, ListFilter } from '@lucide/vue'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { computed, ref, useTemplateRef, watch, watchEffect } from 'vue'

import { onClickOutside, useMediaQuery } from '@vueuse/core'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

export interface FacetMenuOption {
  readonly value: string
  readonly label: string
  readonly count: number
}

type Facet = 'provider' | 'capability' | 'modality' | 'useCase'

const {
  capabilityOptions,
  providerOptions,
  modalityOptions,
  useCaseOptions,
  locale = 'en'
} = defineProps<{
  capabilityOptions: readonly FacetMenuOption[]
  providerOptions: readonly FacetMenuOption[]
  modalityOptions: readonly FacetMenuOption[]
  /** Only where the use-case row has no room of its own, on a phone. */
  useCaseOptions?: readonly FacetMenuOption[]
  locale?: Locale
}>()

const capabilities = defineModel<string[]>('capabilities', { required: true })
const providers = defineModel<string[]>('providers', { required: true })
const modalities = defineModel<string[]>('modalities', { required: true })
const useCases = defineModel<string[]>('useCases', { default: () => [] })

const open = ref(false)
// A dropdown anchored to a crowded toolbar leaves a phone no room, so there
// the panel rises from the bottom of the screen instead.
const isPhone = useMediaQuery('(max-width: 639px)')
const panel = useTemplateRef<HTMLElement>('panel')
onClickOutside(panel, () => (open.value = false), {
  ignore: ['[data-testid="workshop-filter"]']
})

watchEffect((onCleanup) => {
  if (!open.value || !isPhone.value) return
  const previous = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  onCleanup(() => (document.body.style.overflow = previous))
})

const activeFacet = ref<Facet>('provider')
const search = ref<Record<Facet, string>>({
  provider: '',
  capability: '',
  modality: '',
  useCase: ''
})

const facets = computed(() => [
  ...(useCaseOptions
    ? [
        {
          facet: 'useCase' as const,
          label: t('workshop.launch.label', locale),
          options: useCaseOptions,
          selected: useCases
        }
      ]
    : []),
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
  },
  {
    facet: 'modality' as const,
    label: t('workshop.filter.outputGroup', locale),
    options: modalityOptions,
    selected: modalities
  }
])

const selectedCount = computed(
  () =>
    capabilities.value.length + providers.value.length + modalities.value.length
)

// The menu opens on the facet that leads the row, which on a phone is the
// use cases the tab row no longer shows.
watch(open, (value) => {
  if (value) activeFacet.value = facets.value[0].facet
})

function visibleOptions(entry: (typeof facets.value)[number]) {
  const needle = search.value[entry.facet].trim().toLowerCase()
  return needle
    ? entry.options.filter((option) =>
        option.label.toLowerCase().includes(needle)
      )
    : entry.options
}

const modelFor = (facet: Facet) =>
  facet === 'capability'
    ? capabilities
    : facet === 'modality'
      ? modalities
      : facet === 'useCase'
        ? useCases
        : providers

function toggle(facet: Facet, value: string) {
  const selected = modelFor(facet)
  selected.value = selected.value.includes(value)
    ? selected.value.filter((item) => item !== value)
    : [...selected.value, value]
}

function clearAll() {
  capabilities.value = []
  providers.value = []
  modalities.value = []
  useCases.value = []
}
</script>

<template>
  <div class="relative" @keydown.escape="open = false">
    <button
      type="button"
      data-testid="workshop-filter"
      :aria-expanded="open"
      :aria-label="t('workshop.filter.label', locale)"
      :class="
        cn(
          'bg-transparency-white-t4 focus-visible:ring-primary-comfy-yellow/50 inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl px-4 text-sm font-medium transition-colors outline-none hover:bg-transparency-white-t8 focus-visible:ring-3 max-sm:size-10 max-sm:justify-center max-sm:rounded-xl max-sm:bg-white/8 max-sm:px-0',
          selectedCount
            ? 'text-primary-warm-white'
            : 'text-primary-comfy-canvas'
        )
      "
      @click="open = !open"
    >
      <ListFilter class="size-4 shrink-0" aria-hidden="true" />
      <span class="max-sm:hidden">
        {{ t('workshop.filter.label', locale) }}
      </span>
      <span
        v-if="selectedCount"
        class="bg-primary-comfy-yellow inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-primary-comfy-ink tabular-nums"
        data-testid="workshop-filter-count"
      >
        {{ selectedCount }}
      </span>
      <ChevronDown
        :class="
          cn(
            'size-4 transition-transform duration-300 ease-out max-sm:hidden',
            open && 'rotate-180'
          )
        "
        aria-hidden="true"
      />
    </button>

    <Teleport to="body" :disabled="!isPhone">
      <div
        v-if="open"
        class="fixed inset-0 z-40 bg-black/60 sm:hidden"
        data-testid="workshop-filter-backdrop"
        @click="open = false"
      />
      <div
        v-if="open"
        ref="panel"
        data-testid="workshop-filter-menu"
        class="bg-site-dropdown z-50 flex flex-col overflow-y-auto border border-white/10 shadow-2xl shadow-black/50 outline-none max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[85vh] max-sm:rounded-t-3xl sm:absolute sm:top-full sm:right-0 sm:mt-2 sm:max-h-[75vh] sm:w-96 sm:max-w-[calc(100vw-2rem)] sm:rounded-2xl"
      >
        <TabsRoot v-model="activeFacet" class="flex flex-col">
          <TabsList
            class="flex scrollbar-hide items-center gap-1 overflow-x-auto border-b border-white/10 p-2"
          >
            <TabsTrigger
              v-for="entry in facets"
              :key="entry.facet"
              :value="entry.facet"
              :data-testid="`workshop-facet-${entry.facet}`"
              class="text-content-secondary hover:text-content focus-visible:ring-brand data-[state=active]:text-content inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold tracking-wider whitespace-nowrap uppercase transition-colors outline-none hover:bg-white/5 focus-visible:ring-2 data-[state=active]:bg-white/8"
            >
              {{ entry.label }}
              <span
                v-if="entry.selected.value.length"
                class="bg-brand text-page inline-flex size-4 items-center justify-center rounded-full text-2xs font-bold tabular-nums"
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
              <template
                v-for="option in visibleOptions(entry)"
                :key="option.value"
              >
                <li role="none">
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
              </template>
              <li
                v-if="!visibleOptions(entry).length"
                role="none"
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
      </div>
    </Teleport>
  </div>
</template>
