<script setup lang="ts">
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'

const { value, copyLabel, copiedLabel } = defineProps<{
  value: string
  copyLabel: string
  copiedLabel: string
}>()
</script>

<template>
  <div
    class="flex items-start gap-2 rounded-2xl border border-primary-warm-gray bg-transparency-white-t4 p-2 pl-4"
  >
    <span
      class="min-w-0 flex-1 py-3 text-left font-mono text-2xs/relaxed wrap-anywhere whitespace-pre-wrap text-primary-comfy-canvas sm:text-xs/relaxed lg:text-sm/relaxed"
      >{{ value }}</span
    >
    <CopyTextButton
      :value="value"
      :label="copyLabel"
      :copied-label="copiedLabel"
      class="focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow focus-visible:outline-none"
    />
  </div>
</template>
