<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { vRekaZIndex } from '@/components/dialog/vRekaZIndex'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import ToastClose from './ToastClose.vue'
import ToastDescription from './ToastDescription.vue'
import ToastProvider from './ToastProvider.vue'
import ToastRoot from './ToastRoot.vue'
import ToastTitle from './ToastTitle.vue'
import ToastViewport from './ToastViewport.vue'
import { isDocked, useToast } from './toastStore'
import type { ToastId } from './toastStore'

const toast = useToast()
const { toasts } = storeToRefs(toast)
const { isPickingNodes: agentNodeSelectionActive } = storeToRefs(
  useCanvasStore()
)
const stackedToasts = computed(() =>
  toasts.value.filter((message) => !isDocked(message))
)
const dockedToasts = computed(() => toasts.value.filter(isDocked))
const latestToastId = computed(() => stackedToasts.value.at(-1)?.id)
const latestDockedToastId = computed(() => dockedToasts.value.at(-1)?.id)
let escapeToastId: ToastId | undefined

function preserveToastOnEscape(id: ToastId) {
  escapeToastId = id
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
  <ToastProvider>
    <ToastRoot
      v-for="message in stackedToasts"
      :key="message.id"
      :open="true"
      :duration="message.duration"
      :role="message.role"
      data-testid="toast"
      :data-toast-kind="message.kind"
      @escape-key-down="preserveToastOnEscape(message.id)"
      @update:open="updateToastOpen(message.id, $event)"
    >
      <template v-if="message.kind === 'custom'">
        <component
          :is="message.component"
          v-bind="message.props"
          :toast-id="message.id"
        />
      </template>
      <template v-else>
        <i
          :class="cn(icons[message.kind], 'mt-0.5 size-5 shrink-0')"
          aria-hidden="true"
        />
        <div class="min-w-0 flex-1">
          <ToastTitle>{{ message.title }}</ToastTitle>
          <ToastDescription v-if="message.description">
            {{ message.description }}
          </ToastDescription>
        </div>
      </template>
      <ToastClose v-if="message.closable" data-testid="toast-close" />
    </ToastRoot>
    <ToastViewport
      :z-index-version="latestToastId"
      :class="agentNodeSelectionActive ? 'hidden' : undefined"
      data-testid="toast-viewport"
    />
  </ToastProvider>
  <TransitionGroup
    v-reka-z-index="latestDockedToastId"
    tag="div"
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="translate-y-full opacity-0"
    leave-active-class="transition-all duration-200 ease-in"
    leave-to-class="translate-y-full opacity-0"
    class="pointer-events-none fixed inset-x-4 bottom-6 flex flex-col items-center gap-2 *:pointer-events-auto sm:inset-x-0"
  >
    <component
      :is="message.component"
      v-for="message in dockedToasts"
      :key="message.id"
      v-bind="message.props"
      :toast-id="message.id"
    />
  </TransitionGroup>
</template>
