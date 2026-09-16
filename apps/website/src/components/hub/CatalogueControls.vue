<script setup lang="ts">
import { ListFilter, ArrowUpDown } from '@lucide/vue'
import { ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type {
  CatalogueOrder,
  NeedsFilter,
  OutputFilter
} from '../../lib/hub/browse-entry'
import type { EntryKind } from '../../lib/hub/catalogue-entries'

export interface OrderOption {
  readonly value: CatalogueOrder
  readonly label: TranslationKey
  readonly only?: EntryKind
}

const {
  orders,
  providers,
  filtersOn,
  locale = 'en'
} = defineProps<{
  orders: readonly OrderOption[]
  providers: readonly string[]
  filtersOn: boolean
  locale?: Locale
}>()

const emit = defineEmits<{ clear: [] }>()

const order = defineModel<CatalogueOrder>('order', { required: true })
const needs = defineModel<NeedsFilter>('needs', { required: true })
const output = defineModel<OutputFilter>('output', { required: true })
const provider = defineModel<string>('provider', { required: true })

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

// The panel opens on demand and stays open while a filter is set, so what is
// narrowing the grid is never hidden behind a closed button.
const asked = ref(false)

const control =
  'inline-flex h-10 cursor-pointer items-center gap-2 rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 px-4 text-sm text-content outline-none transition-colors hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50'
const selectClass = `${control} pe-3`
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="catalogue-controls">
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        :class="cn(control, filtersOn && 'text-primary-comfy-yellow')"
        :aria-expanded="asked || filtersOn"
        aria-controls="catalogue-filters"
        data-testid="catalogue-filter-toggle"
        @click="asked = !asked"
      >
        <ListFilter class="size-4" aria-hidden="true" />
        {{ t('workshop.v2.filter.label', locale) }}
      </button>

      <ArrowUpDown
        class="ms-2 size-4 shrink-0 text-content-muted"
        aria-hidden="true"
      />
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

    <div
      v-if="asked || filtersOn"
      id="catalogue-filters"
      class="flex flex-wrap items-center gap-2"
    >
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

      <button
        v-if="filtersOn"
        type="button"
        class="cursor-pointer text-xs text-content-muted underline underline-offset-4 hover:text-content-bright"
        @click="emit('clear')"
      >
        {{ t('workshop.v2.clear', locale) }}
      </button>
    </div>
  </div>
</template>
