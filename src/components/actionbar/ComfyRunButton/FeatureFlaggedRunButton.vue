<template>
  <div class="feature-flagged-run-button">
    <!-- Control: Original button -->
    <slot v-if="!isExperimentActive" name="control" />

    <!-- Experiment: Experimental button -->
    <ExperimentalRunButton
      v-else-if="variant"
      :variant="variant"
      :on-click="handleClick"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { FeatureFlagVariant } from '@/composables/useFeatureFlags'

import ExperimentalRunButton from './ExperimentalRunButton.vue'

const props = defineProps<{
  flagKey?: string
  onClick: (e: Event) => void | Promise<void>
}>()

const flagKey = computed(() => props.flagKey || 'demo-run-button-experiment')

const { featureFlag } = useFeatureFlags()
const flagValue = featureFlag<FeatureFlagVariant | boolean | null>(
  flagKey.value,
  false
)

const variant = computed<FeatureFlagVariant | null>(() => {
  const value = flagValue.value
  if (
    typeof value === 'object' &&
    value !== null &&
    'variant' in value &&
    typeof (value as FeatureFlagVariant).variant === 'string'
  ) {
    return value as FeatureFlagVariant
  }
  return null
})

const isExperimentActive = computed(() => {
  return variant.value !== null
})

const handleClick = () => {
  // Create a synthetic event for the onClick handler
  const syntheticEvent = new Event('click') as Event
  props.onClick(syntheticEvent)
}
</script>
