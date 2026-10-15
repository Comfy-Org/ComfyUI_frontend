<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { loadHubModelsGrid } from '@/lib/workshop/catalogue-components'
import WorkshopModelsGrid from './WorkshopModelsGrid.vue'

const {
  hub,
  models,
  initialSearch,
  locale = 'en'
} = defineProps<{
  hub: boolean
  models: readonly WorkshopModel[]
  initialSearch?: string
  locale?: Locale
}>()
const browseAll = defineModel<boolean>('browseAll')
const emit = defineEmits<{ section: [inSection: boolean] }>()

const HubModelsGrid = defineAsyncComponent(loadHubModelsGrid)
</script>

<template>
  <HubModelsGrid v-if="hub" :models :initial-search :locale />
  <WorkshopModelsGrid
    v-else
    v-model:browse-all="browseAll"
    :models
    :initial-search
    :locale
    @section="emit('section', $event)"
  >
    <template #tabs>
      <slot name="tabs" />
    </template>
  </WorkshopModelsGrid>
</template>
