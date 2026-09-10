<script setup lang="ts">
import { ref } from 'vue'

import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import HubBrowse from '../hub/HubBrowse.vue'
import WorkshopHero from './WorkshopHero.vue'
import WorkshopModelsGrid from './WorkshopModelsGrid.vue'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()

const { version } = usePrototypeTweaks()

// Inside a category the category is the heading, so the page's own hero would
// be a second title above it.
const inSection = ref(false)
</script>

<template>
  <HubBrowse v-if="version === 'v2'" :locale />
  <template v-else>
    <WorkshopHero
      v-if="!inSection"
      subtitle-key="workshop.hero.subtitle"
      :locale
    />
    <WorkshopModelsGrid :models :locale @section="inSection = $event" />
  </template>
</template>
