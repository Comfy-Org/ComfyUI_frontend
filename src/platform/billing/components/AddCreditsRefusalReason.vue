<template>
  <p v-if="availability.kind === 'disabled'" :id="reasonId">
    {{ $t(availability.reasonKey) }}
  </p>
</template>

<script setup lang="ts">
import type { AddCreditsAvailability } from '@/platform/billing/addCreditsAvailability'

const { availability, reasonId } = defineProps<{
  availability: AddCreditsAvailability
  reasonId: string
}>()
</script>
