<script setup lang="ts">
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import WorkshopGate from '../WorkshopGate.vue'
import CinematicStudio from './CinematicStudio.vue'

const { models, locale = 'en' } = defineProps<{
  models: readonly CinematicModel[]
  locale?: Locale
}>()
</script>

<template>
  <WorkshopGate>
    <CinematicStudio :models :locale />
    <template #fallback>
      <slot name="fallback" />
    </template>
  </WorkshopGate>
</template>
