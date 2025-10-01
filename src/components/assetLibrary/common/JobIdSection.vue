<template>
  <div class="flex items-center gap-1">
    <span class="text-xs text-muted">{{ `Job: ${jobId}` }}</span>
    <button
      class="p-1 hover:bg-gray-200 dark-theme:hover:bg-gray-700 rounded transition-colors"
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
