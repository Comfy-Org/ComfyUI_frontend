<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ToastProvider } from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import type { ToastId } from '@/types/toastId'

import ToastClose from './ToastClose.vue'
import ToastDescription from './ToastDescription.vue'
import ToastRoot from './ToastRoot.vue'
import ToastTitle from './ToastTitle.vue'
import ToastViewport from './ToastViewport.vue'
import { useToast } from './toastStore'
import type { Toast } from './toastStore'

const toast = useToast()
const { held, toasts } = storeToRefs(toast)
const { t } = useI18n()

const shownToasts = computed(() => (held.value ? [] : toasts.value))
const latestToastId = computed(() => shownToasts.value.at(-1)?.id)
const regionLabel = computed(() => t('toastMessages.notificationsLabel'))

const isAssertive = (item: Toast) =>
  item.kind === 'error' || item.kind === 'warning'
const politeToasts = computed(() =>
  shownToasts.value.filter((item) => !isAssertive(item))
)
const assertiveToasts = computed(() => shownToasts.value.filter(isAssertive))

function announcement(item: Toast) {
  return [item.title, item.description, item.action?.label]
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
  success: 'icon-[lucide--circle-check] text-success-background',
  error: 'icon-[lucide--circle-x] text-destructive-background',
  info: 'icon-[lucide--info] text-primary-background',
  warning: 'icon-[lucide--triangle-alert] text-warning-background',
  loading:
    'icon-[lucide--loader-circle] motion-safe:animate-spin text-primary-background'
} as const
</script>

<template>
  <div class="sr-only">
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      :aria-label="regionLabel"
    >
      <p v-for="item in politeToasts" :key="item.id">
        {{ announcement(item) }}
      </p>
    </div>
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="false"
      :aria-label="regionLabel"
    >
      <p v-for="item in assertiveToasts" :key="item.id">
        {{ announcement(item) }}
      </p>
    </div>
  </div>
  <ToastProvider v-if="shownToasts.length" :label="regionLabel" disable-swipe>
    <ToastRoot
      v-for="item in shownToasts"
      :key="item.id"
      :open="true"
      :duration="item.duration"
      data-testid="toast"
      :data-toast-kind="item.kind"
      @escape-key-down="preserveToastOnEscape($event, item.id)"
      @update:open="updateToastOpen(item.id, $event)"
    >
      <i
        :class="cn(icons[item.kind], 'mt-0.5 size-5 shrink-0')"
        aria-hidden="true"
      />
      <div class="min-w-0 flex-1">
        <ToastTitle>{{ item.title }}</ToastTitle>
        <ToastDescription v-if="item.description">
          {{ item.description }}
        </ToastDescription>
      </div>
      <Button
        v-if="item.action"
        class="shrink-0 self-center"
        size="md"
        variant="inverted"
        @click="item.action.onClick()"
      >
        {{ item.action.label }}
      </Button>
      <ToastClose v-if="item.closable" data-testid="toast-close" />
    </ToastRoot>
    <ToastViewport
      :label="
        (hotkey: string) =>
          t('toastMessages.notificationsViewportLabel', { hotkey })
      "
      :z-index-version="latestToastId"
      data-testid="toast-viewport"
    />
  </ToastProvider>
</template>
