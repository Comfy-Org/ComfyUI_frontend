<script setup lang="ts">
import { ChevronRight, Search } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import type {
  WorkshopBrowseModel,
  WorkshopOutputFilter
} from '../../config/workshop'
import {
  WORKSHOP_INITIAL_MODEL_LIMIT,
  WORKSHOP_OUTPUTS,
  countWorkshopOutputs,
  filterWorkshopModels
} from '../../config/workshop'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopBrowseModel[]
  locale?: Locale
}>()

const query = ref('')
const output = ref<WorkshopOutputFilter>('all')
const provider = ref('all')
const visibleLimit = ref(WORKSHOP_INITIAL_MODEL_LIMIT)

const counts = computed(() => countWorkshopOutputs(models))
const providers = computed(() =>
  [...new Set(models.map((model) => model.provider))].sort()
)
const visibleModels = computed(() =>
  filterWorkshopModels(models, {
    query: query.value,
    output: output.value,
    provider: provider.value
  })
)
const displayedModels = computed(() =>
  visibleModels.value.slice(0, visibleLimit.value)
)

watch([query, output, provider], () => {
  visibleLimit.value = WORKSHOP_INITIAL_MODEL_LIMIT
})

const outputLabelKeys: Record<WorkshopOutputFilter, TranslationKey> = {
  all: 'workshop.filter.all',
  image: 'workshop.filter.image',
  video: 'workshop.filter.video',
  audio: 'workshop.filter.audio',
  '3d': 'workshop.filter.3d'
}

const outputOptions: readonly WorkshopOutputFilter[] = [
  'all',
  ...WORKSHOP_OUTPUTS
]
</script>

<template>
  <header class="mb-10">
    <p
      class="text-primary-comfy-yellow mb-5 text-sm font-medium tracking-widest uppercase"
    >
      {{ t('workshop.hero.eyebrow', locale) }}
    </p>
    <h1 class="text-4xl font-bold text-primary-comfy-canvas lg:text-6xl">
      {{ t('workshop.hero.heading', locale) }}
    </h1>
    <p class="mt-4 max-w-3xl text-lg text-primary-comfy-canvas/70">
      {{ t('workshop.hero.subtitle', locale) }}
    </p>
  </header>

  <div class="mb-8 flex flex-col gap-4">
    <div class="flex flex-col gap-3 sm:flex-row">
      <label class="relative min-w-0 flex-1">
        <span class="sr-only">{{ t('workshop.search.label', locale) }}</span>
        <Search
          aria-hidden="true"
          class="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-primary-comfy-canvas/50"
        />
        <input
          v-model="query"
          type="search"
          :placeholder="t('workshop.search.placeholder', locale)"
          class="focus:border-primary-comfy-yellow h-12 w-full rounded-xl border border-primary-comfy-canvas/15 bg-primary-comfy-canvas/5 pr-4 pl-12 text-primary-comfy-canvas outline-none placeholder:text-primary-comfy-canvas/40"
        />
      </label>
      <label>
        <span class="sr-only">{{ t('workshop.provider.label', locale) }}</span>
        <select
          v-model="provider"
          class="focus:border-primary-comfy-yellow h-12 min-w-48 rounded-xl border border-primary-comfy-canvas/15 bg-primary-comfy-ink px-4 text-primary-comfy-canvas outline-none"
        >
          <option value="all">
            {{ t('workshop.provider.all', locale) }}
          </option>
          <option v-for="name in providers" :key="name" :value="name">
            {{ name }}
          </option>
        </select>
      </label>
    </div>

    <div class="flex gap-2 overflow-x-auto pb-1">
      <button
        v-for="option in outputOptions"
        :key="option"
        type="button"
        :aria-pressed="output === option"
        class="shrink-0 rounded-full border px-4 py-2 text-sm transition-colors"
        :class="
          output === option
            ? 'border-primary-comfy-yellow bg-primary-comfy-yellow text-primary-comfy-ink'
            : 'border-primary-comfy-canvas/15 text-primary-comfy-canvas/70 hover:border-primary-comfy-canvas/40 hover:text-primary-comfy-canvas'
        "
        @click="output = option"
      >
        {{ t(outputLabelKeys[option], locale) }}
        <span class="ml-1 tabular-nums opacity-70">{{ counts[option] }}</span>
      </button>
    </div>
  </div>

  <p class="mb-5 text-sm text-primary-comfy-canvas/60" aria-live="polite">
    {{
      t('workshop.results', locale).replace(
        '{count}',
        String(visibleModels.length)
      )
    }}
  </p>

  <div
    v-if="visibleModels.length > 0"
    class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
  >
    <a
      v-for="model in displayedModels"
      :key="model.id"
      :href="model.href"
      class="group hover:border-primary-comfy-yellow/60 flex min-h-56 flex-col rounded-2xl border border-primary-comfy-canvas/10 bg-primary-comfy-canvas/5 p-6 transition hover:-translate-y-0.5 hover:bg-primary-comfy-canvas/8"
    >
      <p class="text-primary-comfy-yellow text-xs tracking-wider uppercase">
        {{ model.provider }}
      </p>
      <h2 class="mt-2 text-xl font-semibold text-primary-comfy-canvas">
        {{ model.name }}
      </h2>
      <p class="mt-3 line-clamp-3 text-sm text-primary-comfy-canvas/65">
        {{ model.description }}
      </p>
      <div class="mt-auto flex items-end justify-between gap-4 pt-6">
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="tag in model.tags.slice(0, 3)"
            :key="tag"
            class="rounded-full bg-primary-comfy-canvas/8 px-2.5 py-1 text-xs text-primary-comfy-canvas/60"
          >
            {{ tag }}
          </span>
        </div>
        <ChevronRight
          aria-hidden="true"
          class="group-hover:text-primary-comfy-yellow size-5 shrink-0 text-primary-comfy-canvas/50 transition-transform group-hover:translate-x-1"
        />
      </div>
    </a>
  </div>

  <button
    v-if="displayedModels.length < visibleModels.length"
    type="button"
    class="hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow mx-auto mt-8 block rounded-full border border-primary-comfy-canvas/15 px-6 py-3 text-sm text-primary-comfy-canvas transition-colors"
    @click="visibleLimit += WORKSHOP_INITIAL_MODEL_LIMIT"
  >
    {{ t('workshop.showMore', locale) }}
  </button>

  <div
    v-if="visibleModels.length === 0"
    class="rounded-2xl border border-primary-comfy-canvas/10 p-12"
  >
    <p class="text-center text-primary-comfy-canvas/60">
      {{ t('workshop.empty', locale) }}
    </p>
  </div>
</template>
