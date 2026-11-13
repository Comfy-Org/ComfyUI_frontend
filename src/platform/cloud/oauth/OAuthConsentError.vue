<template>
  <div class="flex flex-col gap-3">
    <p
      role="alert"
      class="m-0 rounded-md border border-destructive bg-destructive/10 p-3 text-center text-sm text-destructive"
    >
      {{ message }}
    </p>
    <Button
      v-if="actionLabel"
      variant="secondary"
      size="lg"
      class="w-full bg-ink-500 hover:bg-ink-400"
      :loading
      :disabled="loading"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'

const {
  message,
  actionLabel,
  loading = false
} = defineProps<{
  message: string
  actionLabel?: string
  loading?: boolean
}>()

const emit = defineEmits<{ action: [] }>()
</script>
