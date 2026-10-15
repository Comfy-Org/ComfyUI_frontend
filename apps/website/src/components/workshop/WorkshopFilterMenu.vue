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

import { useVisualViewport } from '@/composables/useVisualViewport'
import type { Modality, UseCase } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ModelAccess } from '@/lib/workshop/explorer/model-access'
import { toggleIn, toggleOption } from '@/lib/workshop/facet-toggle'
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
  useCaseOptions = [],
  modelOptions,
  accessOptions,
  inputOptions,
  outputOptions,
  resultCount,
  kind = 'models',
  locale = 'en'
} = defineProps<{
  useCaseOptions?: readonly FacetMenuOption<T>[]
  /** The models the listing runs on, where it stands on more than its own. */
  modelOptions?: readonly FacetMenuOption<string>[]
  /** How a model can be used: run here, called by API, or downloaded. */
  accessOptions?: readonly FacetMenuOption<ModelAccess>[]
  /** The media a workflow starts from. */
  inputOptions?: readonly FacetMenuOption<Modality>[]
  /** The media a workflow makes. */
  outputOptions?: readonly FacetMenuOption<Modality>[]
  /** What the catalogue holds under the current choices, for the way out. */
  resultCount: number
  kind?: 'models' | 'workflows'
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const useCases = defineModel<T[]>('useCases', { default: () => [] })
const models = defineModel<string[]>('models', { default: () => [] })
const access = defineModel<ModelAccess[]>('access', { default: () => [] })
const inputs = defineModel<Modality[]>('inputs', { default: () => [] })
const outputs = defineModel<Modality[]>('outputs', { default: () => [] })

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

const useCaseLabel = t(
  kind === 'workflows'
    ? 'workshop.catalogue.categories'
    : 'workshop.launch.label'
)

const groups = computed<FacetSheetGroup[]>(() =>
  [
    {
      key: 'useCase',
      label: useCaseLabel,
      options: useCaseOptions,
      selected: useCases.value
    },
    {
      key: 'input',
      label: t('workshop.filter.inputGroup'),
      options: inputOptions ?? [],
      selected: inputs.value
    },
    {
      key: 'output',
      label: t('workshop.filter.outputGroup'),
      options: outputOptions ?? [],
      selected: outputs.value
    },
    {
      key: 'model',
      label: t('workshop.hub.models'),
      options: modelOptions ?? [],
      selected: models.value
    },
    {
      key: 'access',
      label: t('workshop.explorer.filter.label'),
      options: accessOptions ?? [],
      selected: access.value
    }
  ].filter((group) => group.options.length > 0)
)

const selectedCount = computed(() =>
  groups.value.reduce((total, group) => total + group.selected.length, 0)
)

const label = t('workshop.filter.label')

function toggle(facet: string, value: string) {
  if (facet === 'model') models.value = toggleIn(models.value, value)
  else if (facet === 'access')
    access.value = toggleOption(accessOptions, access.value, value)
  else if (facet === 'input')
    inputs.value = toggleOption(inputOptions, inputs.value, value)
  else if (facet === 'output')
    outputs.value = toggleOption(outputOptions, outputs.value, value)
  else useCases.value = toggleOption(useCaseOptions, useCases.value, value)
}

function clearAll() {
  useCases.value = []
  models.value = []
  access.value = []
  inputs.value = []
  outputs.value = []
}

defineExpose({ focus: () => trigger.value?.focus() })

const sheetLabels = computed(() => ({
  title: label,
  search: t('workshop.filter.search'),
  noMatches: t('workshop.filter.noMatches'),
  applied: (n: number) => t('workshop.filter.applied', { n }),
  clearAll: t('workshop.filter.clearAll'),
  show: (n: number) =>
    t(
      kind === 'models'
        ? 'workshop.search.show'
        : 'workshop.catalogue.showWorkflows',
      { n }
    ),
  close: t('workshop.search.close'),
  resize: t('workshop.filter.resize')
}))
</script>

<template>
  <div ref="menu" class="relative" @keydown.escape="open = false">
    <button
      ref="trigger"
      type="button"
      data-testid="workshop-filter"
      :aria-expanded="open"
      :aria-label="label"
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
        {{ label }}
      </span>
      <span
        v-if="selectedCount"
        class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-comfy-yellow px-1 text-3xs leading-none font-bold text-primary-comfy-ink tabular-nums max-sm:absolute max-sm:-top-1 max-sm:-right-1"
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
