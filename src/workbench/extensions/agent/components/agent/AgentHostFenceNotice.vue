<script setup lang="ts">
const { message } = defineProps<{ message: string }>()
</script>

<template>
  <div
    role="alert"
    data-testid="agent-host-fence-notice"
    class="flex items-start gap-3 rounded-lg border border-destructive/40 bg-background p-3 text-sm"
  >
    <i
      aria-hidden="true"
      class="icon-[lucide--circle-alert] size-5 text-destructive"
    />
    <p class="m-0 min-w-0 flex-1">{{ message }}</p>
  </div>
</template>
