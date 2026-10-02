<script setup lang="ts">
import ModelExploreGrid from './ModelExploreGrid.vue'
import type { CardWorkflowItem } from './ModelExploreCard.vue'
import type { ModelMediaTone } from './modelExploreFixtures'

defineProps<{
  entries: { item: CardWorkflowItem; tone: ModelMediaTone }[]
  emptyLabel: string
}>()
</script>

<template>
  <p
    v-if="!entries.length"
    class="py-4 text-center text-base font-light text-content-secondary"
  >
    {{ emptyLabel }}
  </p>
  <ModelExploreGrid v-else :entries variant="hub" class="mt-7" />
</template>
