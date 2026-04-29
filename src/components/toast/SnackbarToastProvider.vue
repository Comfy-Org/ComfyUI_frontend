<template>
  <ToastProvider swipe-direction="down" :duration="DEFAULT_DURATION">
    <slot />
    <SnackbarToast
      v-for="item in toasts"
      :key="item.id"
      :toast="item"
      @dismiss="dismiss(item.id)"
    />
    <ToastViewport
      class="fixed bottom-16 left-1/2 z-1000 m-0 flex -translate-x-1/2 list-none flex-col items-center gap-2 p-0 outline-none"
    />
  </ToastProvider>
</template>

<script setup lang="ts">
import { ToastProvider, ToastViewport } from 'reka-ui'
import { provide, ref } from 'vue'

import type {
  ShowSnackbarOptions,
  SnackbarToastApi,
  SnackbarToastItem
} from '@/composables/useSnackbarToast'
import { SnackbarToastKey } from '@/composables/useSnackbarToast'

import SnackbarToast from './SnackbarToast.vue'

const DEFAULT_DURATION = 2000

const toasts = ref<SnackbarToastItem[]>([])

function createId(): string {
  return `snackbar-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function show(message: string, options: ShowSnackbarOptions = {}): string {
  const item: SnackbarToastItem = { id: createId(), message, ...options }
  toasts.value = [item]
  return item.id
}

function dismiss(id: string): void {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

const api: SnackbarToastApi = { show, dismiss }
provide(SnackbarToastKey, api)
defineExpose(api)
</script>
