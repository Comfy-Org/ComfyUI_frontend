<template>
  <div class="p-8 h-full">
    <Card>
      <template #content>
        <div class="flex flex-col items-center">
          <h3 class="text-4xl">{{ $t('menuLabels.Feedback') }}</h3>
          <Rating v-model="rating" class="flex justify-center">
            <template #onicon>
              <i class="pi pi-star-fill text-4xl"></i>
            </template>
            <template #officon>
              <i class="pi pi-star text-4xl hover:text-highlight" />
            </template>
          </Rating>
        </div>
      </template>
    </Card>
  </div>
  <div>
    <ReportIssuePanel
      error-type="Feedback"
      title="We'd love to hear about your experience with ComfyUI"
      :extra-fields="[ratingField]"
      :default-fields="['SystemStats', 'Settings']"
    />
  </div>
</template>

<script setup lang="ts">
import Card from 'primevue/card'
import Rating from 'primevue/rating'
import { computed, ref } from 'vue'

import type { ReportField } from '@/types/issueReportTypes'

import ReportIssuePanel from './error/ReportIssuePanel.vue'

const rating = ref(null)

const ratingField = computed<ReportField>(() => {
  return {
    label: 'rating',
    value: 'Rating',
    optIn: false,
    data: {
      rating: rating.value
    }
  }
})
</script>
