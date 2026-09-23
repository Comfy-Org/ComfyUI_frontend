<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ChevronDown, ListFilter } from '@lucide/vue'
import { onClickOutside, useMediaQuery, useWindowSize } from '@vueuse/core'
import { FocusScope } from 'reka-ui'
import { computed, ref, useTemplateRef, watchEffect } from 'vue'

import { useVisualViewport } from '../../composables/useVisualViewport'
import type { UseCase } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { FacetSheetGroup } from './FacetSheet.vue'
import FacetSheet from './FacetSheet.vue'

export interface FacetMenuOption {
  readonly value: UseCase
  readonly label: string
  readonly count: number
}

const {
  useCaseOptions,
  resultCount,
  locale = 'en'
} = defineProps<{
  useCaseOptions: readonly FacetMenuOption[]
  /** What the catalogue holds under the current choices, for the way out. */
  resultCount: number
  locale?: Locale
}>()

const useCases = defineModel<UseCase[]>('useCases', { required: true })

const open = ref(false)
// A dropdown anchored to a crowded toolbar leaves a phone no room, so there
// the panel rises from the bottom of the screen instead.
const isPhone = useMediaQuery('(width < 40rem)')
const { height: windowHeight } = useWindowSize()
const { height: visualHeight, offsetTop: visualOffsetTop } = useVisualViewport()
const phoneBottom = computed(() => {
  if (!isPhone.value || visualHeight.value === null) return undefined
  return Math.max(
    0,
    windowHeight.value - (visualOffsetTop.value + visualHeight.value)
  )
})
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

const groups = computed<FacetSheetGroup[]>(() => [
  {
    key: 'useCase',
    label: t('workshop.launch.label', locale),
    options: useCaseOptions,
    selected: useCases.value
  }
])

const selectedCount = computed(() =>
  groups.value.reduce((total, group) => total + group.selected.length, 0)
)

function toggle(_facet: string, value: string) {
  const useCase = useCaseOptions.find((option) => option.value === value)?.value
  if (!useCase) return
  useCases.value = useCases.value.includes(useCase)
    ? useCases.value.filter((item) => item !== useCase)
    : [...useCases.value, useCase]
}

function clearAll() {
  useCases.value = []
}

const sheetLabels = computed(() => ({
  title: t('workshop.filter.label', locale),
  search: t('workshop.filter.search', locale),
  noMatches: t('workshop.filter.noMatches', locale),
  applied: t('workshop.filter.applied', locale),
  clearAll: t('workshop.filter.clearAll', locale),
  show: t('workshop.search.show', locale),
  close: t('workshop.search.close', locale),
  resize: t('workshop.filter.resize', locale)
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
          'relative inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl bg-transparency-white-t4 px-4 text-sm font-medium transition-colors outline-none hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 max-sm:size-10 max-sm:justify-center max-sm:rounded-xl max-sm:bg-white/8 max-sm:px-0',
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
        class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-comfy-yellow px-1 text-[10px] leading-none font-bold text-primary-comfy-ink tabular-nums max-sm:absolute max-sm:-top-1 max-sm:-right-1"
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
          :style="{
            bottom: phoneBottom !== undefined ? `${phoneBottom}px` : undefined
          }"
          class="z-50 flex flex-col overflow-y-auto border border-white/10 bg-site-dropdown shadow-2xl shadow-black/50 outline-none max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:rounded-t-3xl sm:absolute sm:top-full sm:right-0 sm:mt-2 sm:max-h-[75vh] sm:w-96 sm:max-w-[calc(100vw-2rem)] sm:rounded-2xl"
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
