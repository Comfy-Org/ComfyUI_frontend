<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'

import ToastClose from './ToastClose.vue'
import ToastDescription from './ToastDescription.vue'
import ToastProvider from './ToastProvider.vue'
import ToastRoot from './ToastRoot.vue'
import ToastTitle from './ToastTitle.vue'
import ToastViewport from './ToastViewport.vue'
import { useToast } from './toastStore'

const toast = useToast()
const { toasts } = storeToRefs(toast)
const { isActive: agentNodeSelectionActive } = storeToRefs(
  useAgentNodeSelectionStore()
)
const latestToastId = computed(() => toasts.value.at(-1)?.id)

function preserveToastOnEscape(event: KeyboardEvent) {
  event.preventDefault()
}

const icons = {
  success: 'icon-[lucide--circle-check] text-success-background',
  error: 'icon-[lucide--circle-x] text-destructive-background',
  info: 'icon-[lucide--info] text-primary-background',
  warning: 'icon-[lucide--triangle-alert] text-warning-background',
  loading: 'icon-[lucide--loader-circle] animate-spin text-primary-background'
} as const
</script>

<template>
  <ToastProvider>
    <ToastRoot
      v-for="message in toasts"
      :key="message.id"
      :duration="message.duration"
      :role="message.role"
      data-testid="toast"
      :data-toast-kind="message.kind"
      @escape-key-down="preserveToastOnEscape"
      @update:open="(open) => !open && toast.dismiss(message.id)"
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
</template>
