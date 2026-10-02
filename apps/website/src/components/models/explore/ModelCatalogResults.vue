<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import ModelCollectionHeader from './ModelCollectionHeader.vue'
import ModelExploreGrid from './ModelExploreGrid.vue'
import type { CardWorkflowItem } from './ModelExploreCard.vue'
import type { ModelMediaTone } from './modelExploreFixtures'
const {
  catalogLabel,
  isEmpty,
  emptyLabel,
  entries,
  variant,
  hasMoreResults,
  showMoreLabel
} = defineProps<{
  catalogLabel?: string
  isEmpty: boolean
  emptyLabel: string
  entries: { item: CardWorkflowItem; tone: ModelMediaTone }[]
  variant: 'compact' | 'hub'
  hasMoreResults: boolean
  showMoreLabel: string
}>()
const emit = defineEmits<{ loadMore: [] }>()
</script>
<template>
  <ModelCollectionHeader
    v-if="catalogLabel"
    heading-id="model-catalog-heading"
    :label="catalogLabel"
  />
  <p
    v-if="isEmpty"
    class="py-4 text-center text-base font-light text-content-secondary"
  >
    {{ emptyLabel }}
  </p>
  <ModelExploreGrid
    v-else
    :entries="entries"
    :variant="variant"
    :class="cn(catalogLabel && 'mt-7')"
  />
  <div v-if="hasMoreResults" class="mt-8 flex justify-center">
    <button
      type="button"
      class="inline-flex h-10 cursor-pointer items-center justify-center rounded-2xl border border-brand px-12 text-sm font-semibold tracking-wider text-brand uppercase transition-colors hover:bg-brand hover:text-page"
      @click="emit('loadMore')"
    >
      {{ showMoreLabel }}
    </button>
  </div>
</template>
