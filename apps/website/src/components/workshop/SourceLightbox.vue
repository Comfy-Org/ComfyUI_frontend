<script setup lang="ts">
import DialogContent from '@/components/ui/dialog/DialogContent.vue'

const { closeLabel } = defineProps<{ closeLabel: string }>()
const emit = defineEmits<{ dismiss: [] }>()
</script>

<template>
  <DialogContent
    :close-label="closeLabel"
    :aria-describedby="undefined"
    class="inset-0 top-0 left-0 flex h-dvh max-h-dvh w-full translate-0 items-center justify-center rounded-none border-0 bg-primary-comfy-ink/90 p-6 backdrop-blur-sm sm:max-w-none sm:p-6 lg:p-12"
    @click.self="emit('dismiss')"
  >
    <slot />
  </DialogContent>
</template>
