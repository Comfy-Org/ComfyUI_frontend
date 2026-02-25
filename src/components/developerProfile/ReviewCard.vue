<template>
  <div class="flex flex-col gap-2 rounded-lg bg-secondary-background p-4">
    <div class="flex items-center gap-2">
      <div
        class="flex size-8 shrink-0 items-center justify-center rounded-full bg-modal-panel-background"
      >
        <i class="icon-[lucide--user] size-4 text-muted-foreground" />
      </div>
      <span class="text-sm font-medium">{{ review.authorName }}</span>
      <StarRating :rating="review.rating" size="sm" />
      <span class="ml-auto text-xs text-muted-foreground">
        {{ formattedDate }}
      </span>
    </div>
    <p class="m-0 text-sm text-muted-foreground">{{ review.text }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { TemplateReview } from '@/types/templateMarketplace'

import StarRating from './StarRating.vue'

const { review } = defineProps<{
  /** The review to display. */
  review: TemplateReview
}>()

const formattedDate = computed(() =>
  review.createdAt.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
)
</script>
