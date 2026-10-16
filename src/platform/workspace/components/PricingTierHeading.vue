<script setup lang="ts">
const { name, isPopular = false } = defineProps<{
  name: string
  isPopular?: boolean
}>()
</script>

<template>
  <div class="flex items-center justify-between gap-2">
    <span class="font-inter text-base/normal font-bold text-base-foreground">
      {{ name }}
    </span>
    <div
      v-if="isPopular"
      class="flex h-5 items-center rounded-full bg-base-foreground px-1.5 text-2xs font-bold tracking-tight text-base-background uppercase"
    >
      {{ $t('subscription.mostPopular') }}
    </div>
  </div>
</template>
