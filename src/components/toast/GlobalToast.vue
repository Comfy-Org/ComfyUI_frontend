<template>
  <Toast
    position="bottom-right"
    class="graph-toast top-[calc(anchor(--graph-canvas-panel_top,1rem)+0.25rem)] left-[calc(anchor(--graph-canvas-panel_right,anchor(--docked-agent-panel_left,calc(100vw-0.75rem)))-25.5rem)] z-10000 h-fit w-100 [&_.p-toast-close-button]:size-7 [&_.p-toast-close-icon]:size-4 [&_.p-toast-close-icon]:text-base [&_.p-toast-detail]:text-sm [&_.p-toast-message]:mb-4 [&_.p-toast-message]:min-h-[73px] [&_.p-toast-message-content]:gap-2 [&_.p-toast-message-content]:p-3 [&_.p-toast-message-icon]:size-4.5 [&_.p-toast-message-icon]:text-lg [&_.p-toast-message-text]:gap-2 [&_.p-toast-summary]:text-base"
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
import { computed, onScopeDispose, ref, watch } from 'vue'

import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'

/** Paired with the `.p-toast` rule in `src/assets/css/style.css`. */
const NODE_SELECTION_CLASS = 'node-selection-active'

const toast = useToast()
const toastStore = useToastStore()
const agentNodeSelectionStore = useAgentNodeSelectionStore()
const isNodeSelectionActive = computed(() => agentNodeSelectionStore.isActive)

/**
 * Messages raised while node selection mode is active. Adding them straight to
 * a hidden toast layer would let anything carrying a `life` expire unseen, so
 * they are held here and replayed once the mode exits.
 */
const deferredMessages = ref<ToastMessageOptions[]>([])

watch(
  () => toastStore.messagesToAdd,
  (newMessages) => {
    if (newMessages.length === 0) {
      return
    }

    newMessages.forEach((message) => {
      if (isNodeSelectionActive.value) {
        deferredMessages.value.push(message)
      } else {
        toast.add(message)
      }
    })
    toastStore.messagesToAdd = []
  },
  { deep: true }
)

/**
 * PrimeVue teleports every `<Toast>` container to `<body>`, so no wrapper here
 * can hide them - and other components mount their own `<Toast>` groups too.
 * The whole layer is hidden from the root instead (see `style.css`). Messages
 * without a `life` are sticky in PrimeVue, so errors already on screen survive
 * the hide and are still there on exit.
 */
watch(
  isNodeSelectionActive,
  (active) => {
    document.body.classList.toggle(NODE_SELECTION_CLASS, active)
  },
  { immediate: true }
)

onScopeDispose(() => {
  document.body.classList.remove(NODE_SELECTION_CLASS)
})

watch(isNodeSelectionActive, (active) => {
  if (active || deferredMessages.value.length === 0) {
    return
  }

  const pending = deferredMessages.value
  deferredMessages.value = []
  pending.forEach((message) => {
    toast.add(message)
  })
})

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
      toastStore.removeAllRequested = false
    }
  }
)
</script>
