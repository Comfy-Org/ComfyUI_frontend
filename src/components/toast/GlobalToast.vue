<template>
  <Toast />
  <Toast group="partner-node-policy">
    <template #message="slotProps">
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <div class="flex flex-col gap-1">
          <span class="font-semibold">{{ slotProps.message.summary }}</span>
          <span class="text-sm">{{ slotProps.message.detail }}</span>
        </div>
        <Button
          variant="muted-textonly"
          size="sm"
          class="w-fit px-0 underline hover:bg-transparent"
          @click="viewPartnerNodePolicyErrors(slotProps.message)"
        >
          {{ $t('rightSidePanel.viewDetails') }}
        </Button>
      </div>
    </template>
  </Toast>
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
import Toast from 'primevue/toast'
import type { ToastMessageOptions } from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { nextTick, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useViewErrorsInGraph } from '@/composables/useViewErrorsInGraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'

const toast = useToast()
const toastStore = useToastStore()
const settingStore = useSettingStore()
const { viewErrorsInGraph } = useViewErrorsInGraph()

function viewPartnerNodePolicyErrors(message: ToastMessageOptions) {
  toast.remove(message)
  viewErrorsInGraph()
}

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

function updateToastPosition() {
  const styleElement =
    document.getElementById('dynamic-toast-style') || createStyleElement()
  const rect = document
    .querySelector('.graph-canvas-container')
    ?.getBoundingClientRect()
  if (!rect) return

  styleElement.textContent = `
    .p-toast.p-component.p-toast-top-right {
      top: ${rect.top + 100}px !important;
      right: ${window.innerWidth - (rect.left + rect.width) + 20}px !important;
       z-index: 10000 !important;
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
</script>
