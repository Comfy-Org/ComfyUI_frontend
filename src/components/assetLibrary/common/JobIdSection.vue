<template>
  <div class="flex items-center gap-1">
    <span class="text-xs text-muted">{{ `Job: ${jobId}` }}</span>
    <button
      class="rounded p-1 transition-colors hover:bg-gray-200 dark-theme:hover:bg-gray-700"
      :aria-label="`Copy job ID ${jobId}`"
      @click.stop="handleCopy"
    >
      <i class="pi pi-copy text-xs" />
    </button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  jobId: string
}>()

const emit = defineEmits<{
  copy: [jobId: string]
}>()

function handleCopy() {
  emit('copy', props.jobId)
}
</script>
