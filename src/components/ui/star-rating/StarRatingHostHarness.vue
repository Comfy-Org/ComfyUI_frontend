<script setup lang="ts">
import { ref } from 'vue'

import StarRating from './StarRating.vue'
import { provideStarRatingHost } from './starRatingHost'

const modelValue = defineModel<number>({ default: 0 })

const hostRef = ref<HTMLElement>()
provideStarRatingHost(hostRef)
</script>

<template>
  <div
    ref="hostRef"
    data-testid="star-rating-host"
    class="size-48 rounded-lg bg-modal-card-placeholder-background p-4"
  >
    <StarRating v-model="modelValue" presentation="overlay" />
  </div>
</template>
