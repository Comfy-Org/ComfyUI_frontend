<script setup lang="ts">
import { ChevronDown, ListFilter } from '@lucide/vue'
import { computed, ref, useTemplateRef, watchEffect } from 'vue'

import { onClickOutside, useMediaQuery } from '@vueuse/core'
import { FocusScope } from 'reka-ui'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { FacetSheetGroup } from './FacetSheet.vue'
import FacetSheet from './FacetSheet.vue'

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
  resultCount,
  locale = 'en'
} = defineProps<{
  capabilityOptions: readonly FacetMenuOption[]
  providerOptions: readonly FacetMenuOption[]
  modalityOptions: readonly FacetMenuOption[]
  /** Only where the use-case row has no room of its own, on a phone. */
  useCaseOptions?: readonly FacetMenuOption[]
  /** What the catalogue holds under the current choices, for the way out. */
  resultCount: number
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
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
onClickOutside(panel, () => (open.value = false), {
  ignore: ['[data-testid="workshop-filter"]']
})

watchEffect((onCleanup) => {
  if (!open.value || !isPhone.value) return
  const previous = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  onCleanup(() => (document.body.style.overflow = previous))
})

const selectedFor = (facet: Facet) =>
  facet === 'capability'
    ? capabilities
    : facet === 'modality'
      ? modalities
      : facet === 'useCase'
        ? useCases
        : providers

const groups = computed<FacetSheetGroup[]>(() => [
  ...(useCaseOptions
    ? [
        {
          key: 'useCase',
          label: t('workshop.launch.label', locale),
          options: useCaseOptions,
          selected: useCases.value
        }
      ]
    : []),
  {
    key: 'provider',
    label: t('workshop.filter.providerGroup', locale),
    options: providerOptions,
    selected: providers.value
  },
  {
    key: 'capability',
    label: t('workshop.filter.capabilityGroup', locale),
    options: capabilityOptions,
    selected: capabilities.value
  },
  {
    key: 'modality',
    label: t('workshop.filter.outputGroup', locale),
    options: modalityOptions,
    selected: modalities.value
  }
])

const selectedCount = computed(() =>
  groups.value.reduce((total, group) => total + group.selected.length, 0)
)

function toggle(facet: string, value: string) {
  const selected = selectedFor(facet as Facet)
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

const sheetLabels = computed(() => ({
  title: t('workshop.filter.label', locale),
  search: t('workshop.filter.search', locale),
  noMatches: t('workshop.filter.noMatches', locale),
  applied: t('workshop.filter.applied', locale),
  clearAll: t('workshop.filter.clearAll', locale),
  show: t('workshop.search.show', locale),
  close: t('workshop.search.close', locale)
}))
</script>

<template>
  <div class="relative" @keydown.escape="open = false">
    <button
      ref="trigger"
      type="button"
      data-testid="workshop-filter"
      :aria-expanded="open"
      :aria-label="t('workshop.filter.label', locale)"
      :class="
        cn(
          'bg-transparency-white-t4 focus-visible:ring-primary-comfy-yellow/50 relative inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl px-4 text-sm font-medium transition-colors outline-none hover:bg-transparency-white-t8 focus-visible:ring-3 max-sm:size-10 max-sm:justify-center max-sm:rounded-xl max-sm:bg-white/8 max-sm:px-0',
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
        class="bg-primary-comfy-yellow inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-primary-comfy-ink tabular-nums max-sm:absolute max-sm:-top-1 max-sm:-right-1"
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
      <FocusScope
        v-if="open"
        as-child
        :trapped="isPhone"
        loop
        @unmount-auto-focus.prevent="trigger?.focus()"
      >
        <div
          ref="panel"
          role="dialog"
          :aria-label="t('workshop.filter.label', locale)"
          :aria-modal="isPhone || undefined"
          data-testid="workshop-filter-menu"
          class="bg-site-dropdown z-50 flex flex-col overflow-y-auto border border-white/10 shadow-2xl shadow-black/50 outline-none max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[85vh] max-sm:rounded-t-3xl sm:absolute sm:top-full sm:right-0 sm:mt-2 sm:max-h-[75vh] sm:w-96 sm:max-w-[calc(100vw-2rem)] sm:rounded-2xl"
          @keydown.escape.stop.prevent="open = false"
        >
          <FacetSheet
            :groups
            :labels="sheetLabels"
            :result-count
            @toggle="toggle"
            @clear-all="clearAll"
            @close="open = false"
          />
        </div>
      </FocusScope>
    </Teleport>
  </div>
</template>
