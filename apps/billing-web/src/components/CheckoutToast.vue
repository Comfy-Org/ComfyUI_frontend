<template>
  <div
    :role="severity === 'error' ? 'alert' : 'status'"
    :class="
      cn(
        'fixed top-4 right-4 z-10 flex w-100 max-w-[calc(100vw-2rem)] gap-3 rounded-lg border p-4 text-base-foreground backdrop-blur-sm',
        severity === 'error' &&
          'border-destructive-background bg-destructive-background/20',
        severity === 'warn' &&
          'border-warning-background bg-warning-background/20',
        severity === 'info' && 'border-border-default bg-secondary-background'
      )
    "
  >
    <i :class="cn('mt-0.5 text-lg', ICONS[severity])" aria-hidden="true" />
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <p class="m-0 font-semibold">{{ summary }}</p>
      <p v-if="detail" class="m-0 text-sm font-medium">{{ detail }}</p>
    </div>
    <button
      v-if="closeLabel"
      type="button"
      :aria-label="closeLabel"
      class="size-6 shrink-0 cursor-pointer rounded-full text-muted-foreground"
      @click="emit('close')"
    >
      <i class="pi pi-times" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * Where the cloud app shows a toast during and after a checkout payment,
 * billing-web shows this: the same summary and detail, top right, outside
 * the checkout so the steps themselves stay as they were. `info` is the
 * app's processing spinner, `warn` its verify prompt, `error` a refusal.
 */
import { cn } from '@comfyorg/tailwind-utils'

const ICONS = {
  info: 'pi pi-spin pi-spinner text-muted-foreground',
  warn: 'pi pi-exclamation-triangle text-warning-background',
  error: 'pi pi-times-circle text-destructive-background'
} as const

const {
  severity,
  summary,
  detail = '',
  closeLabel = ''
} = defineProps<{
  severity: keyof typeof ICONS
  summary: string
  detail?: string
  closeLabel?: string
}>()

const emit = defineEmits<{
  close: []
}>()
</script>
