<template>
  <Button
    v-if="availability.kind !== 'hidden'"
    :disabled="availability.kind === 'disabled'"
    :aria-describedby="availability.kind === 'disabled' ? reasonId : undefined"
  >
    <slot />
  </Button>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'

import type { AddCreditsAvailability } from '@/platform/billing/addCreditsAvailability'

const { availability, reasonId } = defineProps<{
  availability: AddCreditsAvailability
  reasonId: string
}>()
</script>
