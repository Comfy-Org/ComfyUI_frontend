<script setup lang="ts">
import { computed, ref } from 'vue'

import CardWorkflow01 from '../blocks/CardWorkflow01.vue'
import type { CardWorkflowItem } from '../blocks/CardWorkflow01.vue'
import BrandButton from '../common/BrandButton.vue'

const {
  items,
  catalogHref,
  viewAllLabel,
  loadMoreLabel,
  initialCount = 8
} = defineProps<{
  items: readonly CardWorkflowItem[]
  catalogHref: string
  viewAllLabel: string
  loadMoreLabel: string
  initialCount?: number
}>()

const visibleCount = ref(initialCount)
const visibleItems = computed(() => items.slice(0, visibleCount.value))
const hasMore = computed(() => visibleCount.value < items.length)

function loadMore(): void {
  visibleCount.value += initialCount
}
</script>

<template>
  <div class="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <CardWorkflow01
      v-for="item in visibleItems"
      :key="item.id"
      :item
      variant="compact"
    />
  </div>
  <div class="mt-10 flex flex-col items-center gap-4">
    <BrandButton v-if="hasMore" variant="outline" size="nav" @click="loadMore">
      {{ loadMoreLabel }}
    </BrandButton>
    <BrandButton :href="catalogHref" variant="outline" size="nav">
      {{ viewAllLabel }}
    </BrandButton>
  </div>
</template>
