<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

import WorkshopGate from './WorkshopGate.vue'

const { slug } = defineProps<{ slug?: string }>()
const ModelPage = defineAsyncComponent(() => import('./ModelPage.vue'))
const ModelsCatalogue = defineAsyncComponent(
  () => import('./ModelsCatalogue.vue')
)
</script>

<template>
  <WorkshopGate>
    <Suspense v-if="slug">
      <ModelPage :slug />
    </Suspense>
    <div
      v-else
      class="max-w-10xl lg:short:pt-14 mx-auto px-6 py-16 max-sm:py-10 lg:px-8 lg:py-24"
    >
      <ModelsCatalogue />
    </div>
    <template #fallback>
      <slot name="fallback" />
    </template>
  </WorkshopGate>
</template>
