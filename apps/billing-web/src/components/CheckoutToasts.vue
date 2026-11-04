<template>
  <ToastProvider
    :label="t('checkout.notification')"
    :duration="Number.POSITIVE_INFINITY"
    disable-swipe
  >
    <ToastRoot
      v-for="toast in toasts"
      :key="toast.key"
      :open="true"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      @update:open="emit('close', toast.key)"
    >
      <i
        :class="
          cn(
            toast.variant === 'operation' && toast.severity === 'info'
              ? ICONS.loading
              : ICONS[toast.severity],
            'col-start-1 row-start-1 size-5'
          )
        "
        aria-hidden="true"
      />
      <ToastTitle class="col-start-2 row-start-1">{{
        toast.summary
      }}</ToastTitle>
      <ToastClose :aria-label="closeLabel" class="col-start-3 row-start-1" />
      <ToastDescription v-if="toast.detail" class="col-start-2 row-start-2">
        {{ toast.detail }}
      </ToastDescription>
    </ToastRoot>
    <ToastViewport
      :label="(hotkey) => t('checkout.notifications', { hotkey })"
    />
  </ToastProvider>
</template>

<script setup lang="ts">
import { ToastProvider } from 'reka-ui'
import { useI18n } from 'vue-i18n'

import ToastClose from '@comfyorg/design-system/toast/ToastClose'
import ToastDescription from '@comfyorg/design-system/toast/ToastDescription'
import ToastRoot from '@comfyorg/design-system/toast/ToastRoot'
import ToastTitle from '@comfyorg/design-system/toast/ToastTitle'
import ToastViewport from '@comfyorg/design-system/toast/ToastViewport'
import { cn } from '@comfyorg/tailwind-utils'

export interface CheckoutToastItem {
  readonly key: string
  readonly severity: 'info' | 'warn' | 'error' | 'success'
  readonly summary: string
  readonly detail?: string
  readonly variant?: 'operation' | 'message'
}

const ICONS = {
  success: 'icon-[lucide--circle-check] text-success',
  error: 'icon-[lucide--circle-x] text-destructive',
  info: 'icon-[lucide--info] text-primary',
  warn: 'icon-[lucide--triangle-alert] text-warning',
  loading: 'icon-[lucide--loader-circle] motion-safe:animate-spin text-primary'
} as const

const { toasts, closeLabel } = defineProps<{
  toasts: readonly CheckoutToastItem[]
  closeLabel: string
}>()

const emit = defineEmits<{
  close: [key: string]
}>()

const { t } = useI18n()
</script>
