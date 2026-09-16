<script setup lang="ts">
import { X } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type {
  CatalogueOrder,
  NeedsFilter,
  OutputFilter,
  TypeFilter
} from '../../lib/hub/browse-entry'
import type { EntryKind } from '../../lib/hub/catalogue-entries'

export interface OrderOption {
  readonly value: CatalogueOrder
  readonly label: TranslationKey
  readonly only?: EntryKind
}

const {
  orders,
  counts,
  providers,
  narrowedBy,
  filtersOn,
  locale = 'en'
} = defineProps<{
  orders: readonly OrderOption[]
  /** What choosing each type would return, not how many exist in the abstract. */
  counts: Readonly<Record<TypeFilter, number>>
  providers: readonly string[]
  narrowedBy: EntryKind | undefined
  filtersOn: boolean
  locale?: Locale
}>()

const emit = defineEmits<{ clear: [] }>()

const order = defineModel<CatalogueOrder>('order', { required: true })
const type = defineModel<TypeFilter>('type', { required: true })
const needs = defineModel<NeedsFilter>('needs', { required: true })
const output = defineModel<OutputFilter>('output', { required: true })
const provider = defineModel<string>('provider', { required: true })
const usesModel = defineModel<string>('usesModel', { required: true })

const TYPES: readonly { value: TypeFilter; label: TranslationKey }[] = [
  { value: 'all', label: 'workshop.v2.kind.all' },
  { value: 'model', label: 'workshop.v2.kind.models' },
  { value: 'workflow', label: 'workshop.v2.kind.workflows' },
  { value: 'app', label: 'workshop.v2.kind.apps' }
]

const NEEDS: readonly { value: NeedsFilter; label: TranslationKey }[] = [
  { value: 'any', label: 'workshop.v2.needs.any' },
  { value: 'runsHere', label: 'workshop.v2.needs.runsHere' },
  { value: 'comfyui', label: 'workshop.v2.needs.comfyui' },
  { value: 'customNodes', label: 'workshop.v2.needs.customNodes' }
]

const OUTPUTS: readonly { value: OutputFilter; label: TranslationKey }[] = [
  { value: 'all', label: 'workshop.v2.output.any' },
  { value: 'image', label: 'workshop.hub.io.image' },
  { value: 'video', label: 'workshop.hub.io.video' },
  { value: 'audio', label: 'workshop.hub.io.audio' },
  { value: '3d', label: 'workshop.hub.io.3d' }
]

const selectClass =
  'h-10 cursor-pointer rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 px-3 text-sm text-content outline-none transition-colors hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50'
const chipClass =
  'inline-flex h-8 items-center gap-2 rounded-full bg-transparency-white-t8 px-3 text-xs text-content'

const narrowedLabel = () =>
  t('workshop.v2.sort.narrowed', locale).replace(
    '{type}',
    t(
      narrowedBy === 'model'
        ? 'workshop.v2.kind.models'
        : 'workshop.v2.kind.workflows',
      locale
    ).toLowerCase()
  )
</script>

<template>
  <div class="sticky top-20 z-30 mb-6 bg-page py-4 lg:top-26">
    <div class="mb-2 flex flex-wrap items-center gap-2">
      <label class="sr-only" for="catalogue-order">
        {{ t('workshop.v2.sort.label', locale) }}
      </label>
      <select id="catalogue-order" v-model="order" :class="selectClass">
        <option
          v-for="option in orders"
          :key="option.value"
          :value="option.value"
        >
          {{ t(option.label, locale) }}
        </option>
      </select>
    </div>

    <!-- The second division, under the use case: within "generate videos",
      the models that do it or the workflows built on them. -->
    <div
      class="mb-4 flex flex-wrap items-center gap-6 border-b border-transparency-white-t8"
      data-testid="catalogue-type-facet"
    >
      <button
        v-for="option in TYPES"
        :key="option.value"
        type="button"
        :class="
          cn(
            '-mb-px inline-flex cursor-pointer items-center gap-2 border-b-2 pb-3 text-sm transition-colors',
            type === option.value
              ? 'border-primary-comfy-yellow text-primary-comfy-canvas'
              : 'border-transparent text-content-secondary hover:text-content-bright'
          )
        "
        :aria-pressed="type === option.value"
        :data-active="type === option.value"
        @click="type = option.value"
      >
        {{ t(option.label, locale) }}
        <span class="text-2xs tabular-nums opacity-70">
          {{ counts[option.value] }}
        </span>
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <label class="sr-only" for="catalogue-needs">
        {{ t('workshop.v2.filter.needs', locale) }}
      </label>
      <select id="catalogue-needs" v-model="needs" :class="selectClass">
        <option
          v-for="option in NEEDS"
          :key="option.value"
          :value="option.value"
        >
          {{ t(option.label, locale) }}
        </option>
      </select>

      <label class="sr-only" for="catalogue-output">
        {{ t('workshop.v2.filter.output', locale) }}
      </label>
      <select id="catalogue-output" v-model="output" :class="selectClass">
        <option
          v-for="option in OUTPUTS"
          :key="option.value"
          :value="option.value"
        >
          {{ t(option.label, locale) }}
        </option>
      </select>

      <label class="sr-only" for="catalogue-provider">
        {{ t('workshop.v2.filter.provider', locale) }}
      </label>
      <select id="catalogue-provider" v-model="provider" :class="selectClass">
        <option value="all">
          {{ t('workshop.v2.filter.allProviders', locale) }}
        </option>
        <option v-for="name in providers" :key="name" :value="name">
          {{ name }}
        </option>
      </select>
    </div>

    <div
      v-if="filtersOn"
      class="mt-3 flex flex-wrap items-center gap-2"
      data-testid="catalogue-chips"
    >
      <span v-if="usesModel" :class="chipClass">
        {{ t('workshop.v2.card.runsOn', locale).replace('{model}', usesModel) }}
        <button
          type="button"
          class="cursor-pointer text-content-muted hover:text-content-bright"
          :aria-label="t('workshop.v2.clear', locale)"
          @click="usesModel = ''"
        >
          <X class="size-3" />
        </button>
      </span>
      <!-- An order only one kind can honour narrows the type rather than
        vanishing from the menu, and this chip is the explanation. -->
      <span v-if="narrowedBy" :class="chipClass">{{ narrowedLabel() }}</span>
      <button
        type="button"
        class="cursor-pointer text-xs text-content-muted underline underline-offset-4 hover:text-content-bright"
        @click="emit('clear')"
      >
        {{ t('workshop.v2.clear', locale) }}
      </button>
    </div>
  </div>
</template>
