<script setup lang="ts">
import { ref } from 'vue'

import { translationsFor } from '@/i18n/translations'
import type { CinematicModel } from '@/lib/workshop/cinematic-studio/models'
import type { Locale } from '@/i18n/translations'

const { models, locale = 'en' } = defineProps<{
  models: readonly CinematicModel[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const SHOWN = 8
const expanded = ref(false)
const videoCount = models.filter((model) => model.mode === 'video').length
</script>

<template>
  <section aria-labelledby="cinematic-models">
    <h2
      id="cinematic-models"
      class="text-2xl font-semibold text-primary-warm-white lg:text-4xl"
    >
      {{ t('cinematic.detail.modelsTitle') }}
    </h2>
    <p class="mt-3 max-w-2xl text-primary-warm-gray lg:text-lg">
      {{
        t('cinematic.detail.modelsLead', {
          image: models.length - videoCount,
          video: videoCount
        })
      }}
    </p>
    <ul class="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <li
        v-for="model in expanded ? models : models.slice(0, SHOWN)"
        :key="model.slug"
        class="flex items-center gap-3 rounded-2xl bg-transparency-white-t4 px-4 py-3 ring-1 ring-transparency-white-t8"
      >
        <img :src="model.logo" alt="" class="size-5 shrink-0" />
        <span class="truncate text-sm text-primary-warm-white">
          {{ model.name }}
        </span>
      </li>
    </ul>
    <button
      v-if="models.length > SHOWN"
      type="button"
      :aria-expanded="expanded"
      class="mt-4 text-sm font-medium text-primary-comfy-yellow hover:opacity-90"
      @click="expanded = !expanded"
    >
      {{
        expanded
          ? t('cinematic.detail.showFewerModels')
          : t('cinematic.detail.showAllModels', { count: models.length })
      }}
    </button>
  </section>
</template>
