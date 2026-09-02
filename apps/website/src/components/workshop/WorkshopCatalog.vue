<script setup lang="ts">
import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import type { WorkshopModel } from '../../config/workshop'
import type { Locale } from '../../i18n/translations'
import WorkshopHero from './WorkshopHero.vue'
import WorkshopHubCatalog from './WorkshopHubCatalog.vue'
import WorkshopModelsGrid from './WorkshopModelsGrid.vue'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()

const { entry } = usePrototypeTweaks()
</script>

<template>
  <WorkshopHubCatalog v-if="entry === 'hub'" :models :locale />
  <template v-else>
    <WorkshopHero :locale />
    <WorkshopModelsGrid :models :locale />
  </template>
</template>
