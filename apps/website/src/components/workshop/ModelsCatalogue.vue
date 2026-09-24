<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { ref, watch } from 'vue'
import { useMounted } from '@vueuse/core'

import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import WorkshopHero from './WorkshopHero.vue'
import WorkshopModelsGrid from './WorkshopModelsGrid.vue'
import { captureWorkshopEvent, useWorkshopEnabled } from '../../scripts/posthog'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()

const inSection = ref(false)
const browseAll = ref(false)
const mounted = useMounted()
const enabled = useWorkshopEnabled()

watch(
  () => mounted.value && enabled.value,
  (visible) => {
    if (visible) {
      captureWorkshopEvent({
        name: 'catalogue_viewed',
        properties: { model_count: models.length }
      })
    }
  },
  { once: true }
)
</script>

<template>
  <WorkshopHero
    v-if="!inSection"
    :eyebrow="t('workshop.hero.eyebrow', locale)"
    :heading="t('workshop.hero.heading', locale)"
    :subtitle="t('workshop.hero.subtitle', locale)"
  >
    <template #aside>
      <button
        type="button"
        class="group -mx-1 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-1 text-xl font-medium text-primary-warm-white transition-colors outline-none hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        data-testid="browse-all"
        @click="browseAll = true"
      >
        {{ t('workshop.sections.browseAll', locale) }}
        <ChevronRight
          class="size-5 transition-transform group-hover:translate-x-0.5"
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
