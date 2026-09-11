<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { ref } from 'vue'

import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import WorkshopHero from './WorkshopHero.vue'
import WorkshopModelsGrid from './WorkshopModelsGrid.vue'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()

const inSection = ref(false)
const browseAll = ref(false)
</script>

<template>
  <WorkshopHero v-if="!inSection" subtitle-key="workshop.hero.subtitle" :locale>
    <template #aside>
      <button
        type="button"
        class="group hover:text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 -mx-1 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-1 text-base font-medium text-primary-warm-white transition-colors outline-none focus-visible:ring-3"
        data-testid="browse-all"
        @click="browseAll = true"
      >
        {{ t('workshop.sections.browseAll', locale) }}
        <ChevronRight
          class="size-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
    </template>
  </WorkshopHero>
  <WorkshopModelsGrid
    v-model:browse-all="browseAll"
    :models
    :locale
    @section="inSection = $event"
  />
</template>
