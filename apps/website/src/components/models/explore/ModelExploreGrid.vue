<script setup lang="ts">
import ModelExploreCard from './ModelExploreCard.vue'
import type { CardWorkflowItem } from './ModelExploreCard.vue'
import ModelMediaPlaceholder from './ModelMediaPlaceholder.vue'
import type { ModelMediaTone } from './modelExploreFixtures'

const { entries, variant = 'compact' } = defineProps<{
  variant?: 'compact' | 'hub'
  entries: { item: CardWorkflowItem; tone: ModelMediaTone }[]
}>()
</script>

<template>
  <div class="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
    <ModelExploreCard
      v-for="entry in entries"
      :key="entry.item.id"
      :item="entry.item"
      :variant="variant"
    >
      <template v-if="entry.item.media.type === 'placeholder'" #media>
        <ModelMediaPlaceholder :tone="entry.tone" />
      </template>
    </ModelExploreCard>
  </div>
</template>
