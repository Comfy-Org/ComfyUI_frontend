<script setup lang="ts">
import { Component as ComponentIcon } from '@lucide/vue'

defineProps<{
  credits: string
  label: string
}>()
</script>

<template>
  <div class="mt-6 flex items-center gap-2">
    <ComponentIcon class="text-primary-comfy-orange size-4 shrink-0" />
    <span class="text-primary-warm-white ppformula-text-center text-sm">
      <span class="font-extrabold">
        {{ credits }}
      </span>
      {{ label }}
    </span>
  </div>
</template>
