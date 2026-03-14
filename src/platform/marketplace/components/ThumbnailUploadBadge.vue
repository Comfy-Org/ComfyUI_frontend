<template>
  <div
    v-if="progress != null || complete"
    class="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-full p-2 shadow-sm"
    :class="
      complete
        ? 'text-success-foreground bg-success-background'
        : 'bg-base-background/90 text-base-foreground'
    "
    role="status"
    :aria-valuenow="progress ?? undefined"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="
      complete
        ? $t('marketplace.uploadComplete')
        : $t('marketplace.uploadProgress', { percent: progress ?? 0 })
    "
  >
    <i
      v-if="complete"
      class="icon-[lucide--check] size-4 shrink-0"
      aria-hidden
    />
    <i
      v-else
      class="icon-[lucide--loader-circle] size-4 shrink-0 animate-spin"
      aria-hidden
    />
    <span v-if="!complete" class="text-xs font-medium"> {{ progress }}% </span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  progress?: number | null
  complete?: boolean
}>()
</script>
