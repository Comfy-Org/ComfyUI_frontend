<template>
  <Toast class="graph-toast" />
  <Toast group="billing-operation" position="top-right">
    <template #message="slotProps">
      <div class="flex items-center gap-2">
        <i class="pi pi-spin pi-spinner text-primary" />
        <span>{{ slotProps.message.summary }}</span>
      </div>
    </template>
  </Toast>
</template>

<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { nextTick, watch } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

const toast = useToast()
const toastStore = useToastStore()
const settingStore = useSettingStore()
const { isOpen: agentPanelOpen, width: agentPanelWidth } =
  storeToRefs(useAgentPanelStore())

watch(
  () => toastStore.messagesToAdd,
  (newMessages) => {
    if (newMessages.length === 0) {
      return
    }

    newMessages.forEach((message) => {
      toast.add(message)
    })
    toastStore.messagesToAdd = []
    void nextTick(updateToastPosition)
  },
  { deep: true }
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
      toastStore.removeAllRequested = false
    }
  }
)

function visibleRect(selector: string): DOMRect | undefined {
  const rect = document.querySelector(selector)?.getBoundingClientRect()
  return rect !== undefined && rect.width > 0 ? rect : undefined
}

function updateToastPosition() {
  const container = visibleRect('.graph-canvas-container')
  // App mode hides the graph container; anchor beside the docked panel there.
  const anchor = container ?? visibleRect('.docked-agent-panel')
  if (anchor === undefined) return
  // With the agent panel closed the pane gutter still offsets the splitter
  // rect, so only its edge counts while the panel actually takes space.
  const edge = container
    ? agentPanelOpen.value
      ? (visibleRect('.graph-canvas-panel') ?? container)
      : container
    : undefined
  const right =
    edge === undefined
      ? window.innerWidth - anchor.left + 20
      : window.innerWidth - (edge.left + edge.width) + 20
  const styleElement =
    document.getElementById('dynamic-toast-style') || createStyleElement()

  styleElement.textContent = `
    .p-toast.p-component.p-toast-top-right {
      top: ${anchor.top + 100}px !important;
      right: ${right}px !important;
       z-index: 10000 !important;
    }
    .graph-toast.p-toast.p-component.p-toast-top-right {
      width: 400px;
    }
    .graph-toast .p-toast-message {
      min-height: 73px;
      margin-bottom: 16px;
    }
    .graph-toast .p-toast-message-content {
      padding: 12px;
      gap: 8px;
    }
    .graph-toast .p-toast-message-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }
    .graph-toast .p-toast-message-text {
      gap: 8px;
    }
    .graph-toast .p-toast-summary {
      font-size: 16px;
    }
    .graph-toast .p-toast-detail {
      font-size: 14px;
    }
    .graph-toast .p-toast-close-button {
      width: 28px;
      height: 28px;
    }
    .graph-toast .p-toast-close-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }
  `
}

function createStyleElement() {
  const style = document.createElement('style')
  style.id = 'dynamic-toast-style'
  document.head.appendChild(style)
  return style
}

watch(
  () => settingStore.get('Comfy.UseNewMenu'),
  () => nextTick(updateToastPosition),
  { immediate: true }
)
watch(
  () => settingStore.get('Comfy.Sidebar.Location'),
  () => nextTick(updateToastPosition),
  { immediate: true }
)
watchDebounced(
  [agentPanelOpen, agentPanelWidth],
  () => nextTick(updateToastPosition),
  { debounce: 100 }
)
</script>
