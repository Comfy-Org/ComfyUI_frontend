<template>
  <ImageCompare
    :tabindex="widget.options?.tabindex ?? 0"
    :aria-label="widget.options?.ariaLabel"
    :aria-labelledby="widget.options?.ariaLabelledby"
    :pt="widget.options?.pt"
    :pt-options="widget.options?.ptOptions"
    :unstyled="widget.options?.unstyled"
  >
    <template #left>
      <img
        :src="beforeImage"
        :alt="beforeAlt"
        class="h-full w-full object-cover"
      />
    </template>
    <template #right>
      <img
        :src="afterImage"
        :alt="afterAlt"
        class="h-full w-full object-cover"
      />
    </template>
  </ImageCompare>
</template>

<script setup lang="ts">
import ImageCompare from 'primevue/imagecompare'
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

export interface ImageCompareValue {
  before: string
  after: string
  beforeAlt?: string
  afterAlt?: string
  initialPosition?: number
}

// Image compare widgets typically don't have v-model, they display comparison
const props = defineProps<{
  widget: SimplifiedWidget<ImageCompareValue | string>
}>()

const beforeImage = computed(() => {
  const value = props.widget.value
  return typeof value === 'string' ? value : value?.before || ''
})

const afterImage = computed(() => {
  const value = props.widget.value
  return typeof value === 'string' ? '' : value?.after || ''
})

const beforeAlt = computed(() => {
  const value = props.widget.value
  return typeof value === 'object' && value?.beforeAlt
    ? value.beforeAlt
    : 'Before image'
})

const afterAlt = computed(() => {
  const value = props.widget.value
  return typeof value === 'object' && value?.afterAlt
    ? value.afterAlt
    : 'After image'
})
</script>
