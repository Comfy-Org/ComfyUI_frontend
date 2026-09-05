<script setup lang="ts">
defineProps<{ step: number; title: string; note?: string }>()
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <h3 class="flex items-center gap-2.5">
      <span
        class="bg-primary-comfy-yellow grid size-5 shrink-0 place-items-center rounded-full text-2xs font-bold text-primary-comfy-ink"
        aria-hidden="true"
      >
        {{ step }}
      </span>
      <span
        class="text-xs font-bold tracking-wider text-primary-warm-white uppercase"
      >
        {{ title }}
      </span>
    </h3>
    <p v-if="note" class="text-xs text-primary-warm-gray">{{ note }}</p>
  </div>
</template>
