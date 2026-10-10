<script setup lang="ts">
import { CircleCheck, CircleX, TriangleAlert, X } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import {
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastViewport
} from 'reka-ui'
import { computed } from 'vue'
import type { Component } from 'vue'

import IconButton from '@/components/ui/icon-button/IconButton.vue'
import type { AuthToast, AuthToastKind } from '@/config/auth-toast-state'
import { dismissAuthToast, useAuthToasts } from '@/config/auth-toast-state'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const { toasts } = useAuthToasts()

const politeToasts = computed(() =>
  toasts.value.filter((toast) => toast.kind === 'success')
)
const assertiveToasts = computed(() =>
  toasts.value.filter((toast) => toast.kind !== 'success')
)

let escapeToastId: number | undefined

function preserveToastOnEscape(event: KeyboardEvent, id: number) {
  if (!event.defaultPrevented) escapeToastId = id
}

function updateToastOpen(id: number, open: boolean) {
  if (open) return
  if (escapeToastId === id) {
    escapeToastId = undefined
    return
  }
  dismissAuthToast(id)
}

function announcement(toast: AuthToast) {
  return [toast.title, toast.description].filter(Boolean).join('. ')
}

const KIND_ICON = {
  error: { icon: CircleX, class: 'text-destructive' },
  success: { icon: CircleCheck, class: 'text-brand' },
  warning: { icon: TriangleAlert, class: 'text-primary-comfy-orange' }
} satisfies Record<AuthToastKind, { icon: Component; class: string }>
</script>

<template>
  <div class="sr-only">
    <div aria-live="polite">
      <p v-for="toast in politeToasts" :key="toast.id">
        {{ announcement(toast) }}
      </p>
    </div>
    <div aria-live="assertive">
      <p v-for="toast in assertiveToasts" :key="toast.id">
        {{ announcement(toast) }}
      </p>
    </div>
  </div>
  <ToastProvider v-if="toasts.length" disable-swipe>
    <ToastRoot
      v-for="toast in toasts"
      :key="toast.id"
      :open="true"
      :duration="toast.duration"
      class="pointer-events-auto flex items-start gap-3 rounded-2xl border border-primary-comfy-canvas/15 bg-primary-comfy-ink-light p-4 text-primary-comfy-canvas shadow-lg"
      @escape-key-down="preserveToastOnEscape($event, toast.id)"
      @update:open="updateToastOpen(toast.id, $event)"
    >
      <div class="contents" data-reka-toast-announce-exclude="">
        <component
          :is="KIND_ICON[toast.kind].icon"
          :class="cn('mt-0.5 size-5 shrink-0', KIND_ICON[toast.kind].class)"
          aria-hidden="true"
        />
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <ToastTitle class="font-medium text-primary-warm-white">
            {{ toast.title }}
          </ToastTitle>
          <ToastDescription
            v-if="toast.description"
            class="text-sm wrap-break-word whitespace-pre-line"
          >
            {{ toast.description }}
          </ToastDescription>
        </div>
        <ToastClose as-child>
          <IconButton size="sm" :aria-label="t('auth.toast.close')">
            <X class="size-4" aria-hidden="true" />
          </IconButton>
        </ToastClose>
      </div>
    </ToastRoot>
    <ToastViewport
      :label="(hotkey: string) => t('auth.toast.viewportLabel', { hotkey })"
      class="fixed top-5 right-3 z-10000 flex w-[min(25rem,calc(100vw-1.5rem))] flex-col gap-4 outline-none"
    />
  </ToastProvider>
</template>
