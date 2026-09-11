<script setup lang="ts">
import { ref, watch } from 'vue'
import { useMounted } from '@vueuse/core'

import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import WorkshopHero from './WorkshopHero.vue'
import WorkshopModelsGrid from './WorkshopModelsGrid.vue'
import { captureWorkshopEvent, useWorkshopEnabled } from '../../scripts/posthog'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()

// Inside a category the category is the heading, so the page's own hero would
// be a second title above it.
const inSection = ref(false)
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
    subtitle-key="workshop.hero.subtitle"
    :locale
  />
  <WorkshopModelsGrid :models :locale @section="inSection = $event" />
</template>
