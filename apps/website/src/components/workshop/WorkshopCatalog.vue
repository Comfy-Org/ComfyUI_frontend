<script setup lang="ts">
import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import type { WorkshopModel } from '../../config/workshop'
import type { Locale } from '../../i18n/translations'
import HubBrowse from '../hub/HubBrowse.vue'
import WorkshopHero from './WorkshopHero.vue'
import WorkshopModelsGrid from './WorkshopModelsGrid.vue'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()

const { version } = usePrototypeTweaks()
</script>

<template>
  <HubBrowse v-if="version === 'v2'" :locale />
  <template v-else>
    <WorkshopHero subtitle-key="workshop.hero.subtitle" :locale />
    <WorkshopModelsGrid :models :locale />
  </template>
</template>
