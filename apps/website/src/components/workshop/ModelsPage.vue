<script setup lang="ts">
import { defineAsyncComponent, h, useSlots } from 'vue'

import {
  fetchModelsCatalogue,
  fetchModelsPage
} from '../../config/models-page-data'

import WorkshopGate from './WorkshopGate.vue'

const { slug } = defineProps<{ slug?: string }>()
const slots = useSlots()
const fallback = () => slots.fallback?.()
const Content = defineAsyncComponent({
  loader: async () => {
    if (slug) {
      const [{ default: ModelPage }, page] = await Promise.all([
        import('./ModelPage.vue'),
        fetchModelsPage(slug)
      ])
      return () => h(ModelPage, { page })
    }
    const [{ default: ModelsCatalogue }, models] = await Promise.all([
      import('./ModelsCatalogue.vue'),
      fetchModelsCatalogue()
    ])
    return () =>
      h(
        'div',
        {
          class:
            'max-w-10xl lg:short:pt-14 mx-auto px-6 py-16 max-sm:py-10 lg:px-8 lg:py-24'
        },
        [h(ModelsCatalogue, { models })]
      )
  },
  loadingComponent: fallback,
  errorComponent: fallback,
  delay: 0
})
</script>

<template>
  <WorkshopGate>
    <Content />
    <template #fallback>
      <slot name="fallback" />
    </template>
  </WorkshopGate>
</template>
