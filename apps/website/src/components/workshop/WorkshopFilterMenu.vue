<script setup lang="ts" generic="T extends string = UseCase">
import { ChevronDown, ListFilter } from '@lucide/vue'
import {
  computed,
  defineAsyncComponent,
  ref,
  useTemplateRef,
  watchEffect
} from 'vue'

import { onClickOutside, useMediaQuery, useWindowSize } from '@vueuse/core'
import type { ComponentExposed } from 'vue-component-type-helpers'

import { cn } from '@comfyorg/tailwind-utils'

import { useVisualViewport } from '../../composables/useVisualViewport'
import type { UseCase } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { FacetSheetGroup } from './FacetSheet.vue'

export interface FacetMenuOption<T extends string = UseCase> {
  readonly value: T
  readonly label: string
  readonly count: number
}

const WorkshopFilterPanel = defineAsyncComponent(
  () => import('./WorkshopFilterPanel.vue')
)

const {
  useCaseOptions,
  modelOptions,
  resultCount,
  kind = 'models',
  locale = 'en'
} = defineProps<{
  useCaseOptions: readonly FacetMenuOption<T>[]
  /** The models the listing runs on, where it stands on more than its own. */
  modelOptions?: readonly FacetMenuOption<string>[]
  /** What the catalogue holds under the current choices, for the way out. */
  resultCount: number
  kind?: 'models' | 'workflows'
  locale?: Locale
}>()

const useCases = defineModel<T[]>('useCases', { required: true })
const models = defineModel<string[]>('models', { default: () => [] })

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
const menu = useTemplateRef<HTMLElement>('menu')
const panel =
  useTemplateRef<ComponentExposed<typeof WorkshopFilterPanel>>('panel')
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
onClickOutside(
  () => {
    const element: unknown = panel.value?.$el
    return element instanceof HTMLElement ? element : menu.value
  },
  () => (open.value = false),
  { ignore: ['[data-testid="workshop-filter"]'] }
)

watchEffect((onCleanup) => {
  if (!open.value || !isPhone.value) return
  const previous = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  onCleanup(() => (document.body.style.overflow = previous))
})

const groups = computed<FacetSheetGroup[]>(() => [
  {
    key: 'useCase',
    label: t(
      kind === 'workflows'
        ? 'workshop.catalogue.categories'
        : 'workshop.launch.label',
      locale
    ),
    options: useCaseOptions,
    selected: useCases.value
  },
  ...(modelOptions?.length
    ? [
        {
          key: 'model',
          label: t('workshop.hub.models', locale),
          options: modelOptions,
          selected: models.value
        }
      ]
    : [])
])

const selectedCount = computed(() =>
  groups.value.reduce((total, group) => total + group.selected.length, 0)
)

function toggle(facet: string, value: string) {
  if (facet === 'model') {
    models.value = models.value.includes(value)
      ? models.value.filter((item) => item !== value)
      : [...models.value, value]
    return
  }
  const useCase = useCaseOptions.find((option) => option.value === value)?.value
  if (!useCase) return
  useCases.value = useCases.value.includes(useCase)
    ? useCases.value.filter((item) => item !== useCase)
    : [...useCases.value, useCase]
}

function clearAll() {
  useCases.value = []
  models.value = []
}

const sheetLabels = computed(() => ({
  title: t('workshop.filter.label', locale),
  search: t('workshop.filter.search', locale),
  noMatches: t('workshop.filter.noMatches', locale),
  applied: t('workshop.filter.applied', locale),
  clearAll: t('workshop.filter.clearAll', locale),
  show: t(
    kind === 'models'
      ? 'workshop.search.show'
      : 'workshop.catalogue.showWorkflows',
    locale
  ),
  close: t('workshop.search.close', locale),
  resize: t('workshop.filter.resize', locale)
}))
</script>

<template>
  <div ref="menu" class="relative" @keydown.escape="open = false">
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
      <WorkshopFilterPanel
        v-if="open"
        ref="panel"
        :groups
        :labels="sheetLabels"
        :result-count
        :is-phone
        :bottom="phoneBottom"
        @toggle="toggle"
        @clear-all="clearAll"
        @close="open = false"
        @restore-focus="trigger?.focus()"
      />
    </Teleport>
  </div>
</template>
