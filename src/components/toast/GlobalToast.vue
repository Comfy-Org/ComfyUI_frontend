<template>
  <Toast
    position="bottom-right"
    class="graph-toast top-[calc(anchor(--graph-canvas-panel_top,1rem)+0.25rem)] left-[calc(anchor(--graph-canvas-panel_right,anchor(--docked-agent-panel_left,calc(100vw-var(--workspace-inset-right,0px)-0.75rem)))-25.5rem)] z-10000 h-fit w-100 [&_.p-toast-close-button]:size-7 [&_.p-toast-close-icon]:size-4 [&_.p-toast-close-icon]:text-base [&_.p-toast-detail]:text-sm [&_.p-toast-message]:mb-4 [&_.p-toast-message]:min-h-[73px] [&_.p-toast-message-content]:gap-2 [&_.p-toast-message-content]:p-3 [&_.p-toast-message-icon]:size-4.5 [&_.p-toast-message-icon]:text-lg [&_.p-toast-message-text]:gap-2 [&_.p-toast-summary]:text-base"
  />
  <Toast group="billing-operation" position="top-right">
    <template #message="slotProps">
      <div class="flex items-center gap-2">
        <!-- A spinner claims work is underway; an operation waiting on the
             customer is not underway, so it gets a prompt icon instead. -->
        <i
          v-if="slotProps.message.severity === 'warn'"
          class="pi pi-exclamation-circle text-warning-background"
          aria-hidden="true"
        />
        <i
          v-else
          class="pi pi-spin pi-spinner text-primary"
          aria-hidden="true"
        />
        <span>{{ slotProps.message.summary }}</span>
      </div>
    </template>
  </Toast>
</template>

<script setup lang="ts">
import Toast from 'primevue/toast'
import type { ToastMessageOptions } from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { watch } from 'vue'

import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'

const toast = useToast()
const toastStore = useToastStore()
const agentNodeSelectionStore = useAgentNodeSelectionStore()

/**
 * Messages raised while node selection mode is active. The mode hides the whole
 * toast layer, and adding to a hidden layer would let anything carrying a `life`
 * expire unseen - so they are held here and replayed on exit. Messages without a
 * `life` are sticky in PrimeVue, so errors already on screen survive the hide
 * untouched. Deliberately a plain array: nothing renders it.
 */
let deferredMessages: ToastMessageOptions[] = []

watch(
  () => toastStore.messagesToAdd,
  (newMessages) => {
    if (newMessages.length === 0) {
      return
    }

    newMessages.forEach((message) => {
      if (agentNodeSelectionStore.isActive) {
        deferredMessages.push(message)
      } else {
        toast.add(message)
      }
    })
    toastStore.messagesToAdd = []
  },
  { deep: true }
)

watch(
  () => agentNodeSelectionStore.isActive,
  (active) => {
    if (active) return
    deferredMessages.splice(0).forEach((message) => {
      toast.add(message)
    })
  }
)

watch(
  () => toastStore.messagesToRemove,
  (messagesToRemove) => {
    if (messagesToRemove.length === 0) {
      return
    }

    messagesToRemove.forEach((message) => {
      toast.remove(message)
    })
    toastStore.messagesToRemove = []
  },
  { deep: true }
)

watch(
  () => toastStore.removeAllRequested,
  (requested) => {
    if (requested) {
      toast.removeAllGroups()
      // Held messages were cleared too - replaying them on exit would resurrect
      // exactly what the caller just dismissed.
      deferredMessages = []
      toastStore.removeAllRequested = false
    }
  }
)
</script>
