<script setup lang="ts">
defineProps<{
  plan: {
    readonly name?: string
    readonly price?: string
    readonly period?: string
  }
}>()
</script>

<template>
  <div
    class="flex w-full flex-col gap-2 rounded-lg bg-secondary-background p-6 text-left"
    data-testid="checkout-ending-plan"
  >
    <p v-if="plan.name" class="m-0 text-base font-bold text-base-foreground">
      {{ plan.name }}
    </p>
    <p v-if="plan.price" class="m-0 text-base-foreground tabular-nums">
      <span class="text-[2rem] font-semibold">{{ plan.price }}</span>
      {{ plan.period }}
    </p>
  </div>
</template>
