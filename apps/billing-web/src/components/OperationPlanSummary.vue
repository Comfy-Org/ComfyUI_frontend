<script setup lang="ts">
import type { OperationPlanLabel } from '@/checkout/operationPlan'

/**
 * A recovered payment's plan as the server reports it. Renders nothing while
 * no recovered payment is shown, so a step's own summary stands.
 */
const { recovered } = defineProps<{
  recovered?: { readonly label?: OperationPlanLabel }
}>()
</script>

<template>
  <div
    v-if="recovered"
    class="flex flex-col gap-2"
    data-testid="checkout-operation-plan"
  >
    <span v-if="recovered.label?.name" class="text-sm text-base-foreground">
      {{ recovered.label.name }}
    </span>
    <p
      v-if="recovered.label?.price"
      class="m-0 flex items-baseline gap-2 text-base-foreground tabular-nums"
    >
      <span class="text-2xl font-semibold">{{ recovered.label.price }}</span>
      <span class="text-base">{{ recovered.label.period }}</span>
    </p>
  </div>
</template>
