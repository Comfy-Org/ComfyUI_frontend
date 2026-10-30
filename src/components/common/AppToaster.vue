<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ToastProvider } from 'reka-ui'
import { computed, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@comfyorg/design-system/button/Button'
import ToastClose from '@comfyorg/design-system/toast/ToastClose'
import ToastDescription from '@comfyorg/design-system/toast/ToastDescription'
import ToastRoot from '@comfyorg/design-system/toast/ToastRoot'
import ToastTitle from '@comfyorg/design-system/toast/ToastTitle'
import ToastViewport from '@comfyorg/design-system/toast/ToastViewport'
import { useToast } from '@/components/ui/toast/toastStore'
import type { Toast } from '@/components/ui/toast/toastStore'
import type { ToastId } from '@/types/toastId'

const { t } = useI18n()

const toast = useToast()
const { held, toasts } = storeToRefs(toast)

onBeforeUnmount(toast.dismissAll)

const shownToasts = computed(() => (held.value ? [] : toasts.value))

const isAssertive = (item: Toast) =>
  item.kind === 'error' || item.kind === 'warning'
const politeToasts = computed(() =>
  toasts.value.filter((item) => !isAssertive(item))
)
const assertiveToasts = computed(() => toasts.value.filter(isAssertive))

function announcement(item: Toast) {
  return [
    item.title,
    item.description,
    ...item.actions.map((action) => action.label)
  ]
    .filter(Boolean)
    .join('. ')
}

let escapeToastId: ToastId | undefined

function preserveToastOnEscape(event: KeyboardEvent, id: ToastId) {
  if (!event.defaultPrevented) escapeToastId = id
}

function updateToastOpen(id: ToastId, open: boolean) {
  if (open) return
  if (escapeToastId === id) {
    escapeToastId = undefined
    return
  }
  toast.dismiss(id)
}

const icons = {
  success: 'icon-[lucide--circle-check] text-success',
  error: 'icon-[lucide--circle-x] text-destructive',
  info: 'icon-[lucide--info] text-primary',
  warning: 'icon-[lucide--triangle-alert] text-warning',
  loading: 'icon-[lucide--loader-circle] motion-safe:animate-spin text-primary'
} as const
</script>

<template>
  <div class="sr-only">
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      :aria-label="t('toastMessages.notificationsLabel')"
    >
      <p v-for="item in politeToasts" :key="item.id">
        {{ announcement(item) }}
      </p>
    </div>
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="false"
      :aria-label="t('toastMessages.notificationsLabel')"
    >
      <p v-for="item in assertiveToasts" :key="item.id">
        {{ announcement(item) }}
      </p>
    </div>
  </div>
  <ToastProvider
    v-if="shownToasts.length"
    :label="t('toastMessages.notificationsLabel')"
    disable-swipe
  >
    <ToastRoot
      v-for="item in shownToasts"
      :key="item.instance"
      :open="true"
      :duration="item.duration"
      data-testid="toast"
      :data-toast-kind="item.kind"
      @escape-key-down="preserveToastOnEscape($event, item.id)"
      @update:open="updateToastOpen(item.id, $event)"
    >
      <i
        :class="cn(icons[item.kind], 'col-start-1 row-start-1 size-5')"
        aria-hidden="true"
      />
      <ToastTitle class="col-start-2 row-start-1">{{ item.title }}</ToastTitle>
      <ToastClose
        v-if="item.closable"
        :aria-label="t('g.close')"
        class="col-start-3 row-start-1"
        data-testid="toast-close"
        @click="toast.close(item.id)"
      />
      <ToastDescription v-if="item.description" class="col-start-2 row-start-2">
        {{ item.description }}
      </ToastDescription>
      <div
        class="col-span-2 col-start-2 row-start-3 mt-3 flex justify-end gap-2 empty:hidden"
      >
        <Button
          v-for="(action, index) in item.actions"
          :key="`${action.label}-${index}`"
          size="md"
          variant="secondary"
          @click="action.onClick()"
        >
          {{ action.label }}
        </Button>
      </div>
    </ToastRoot>
    <ToastViewport
      :label="
        (hotkey) => t('toastMessages.notificationsViewportLabel', { hotkey })
      "
      data-testid="toast-viewport"
    />
  </ToastProvider>
</template>
