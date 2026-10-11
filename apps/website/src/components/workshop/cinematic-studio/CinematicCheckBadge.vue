<script setup lang="ts">
import { Check } from '@lucide/vue'
</script>

<template>
  <span
    class="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-primary-comfy-yellow text-primary-comfy-ink shadow-md"
    aria-hidden="true"
  >
    <Check class="size-3.5" :stroke-width="3" />
  </span>
</template>
