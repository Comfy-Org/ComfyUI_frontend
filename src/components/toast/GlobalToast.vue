<template>
  <Toast :auto-z-index="false" :pt="toastPt" />
  <Toast
    group="billing-operation"
    position="top-right"
    :auto-z-index="false"
    :pt="toastPt"
  >
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
import { useEventListener } from '@vueuse/core'
import Toast from 'primevue/toast'
import type { ToastPassThroughOptions } from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { nextTick, onUnmounted, watch } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { createRafBatch } from '@/utils/rafBatch'

const toast = useToast()
const toastStore = useToastStore()
const settingStore = useSettingStore()
const toastPt = {
  root: {
    class:
      'z-10000 max-sm:max-w-[calc(100vw-2rem)] max-sm:[--toast-mobile-right:1rem]',
    style: {
      top: 'var(--toast-top)',
      right: 'var(--toast-mobile-right, var(--toast-right))'
    }
  }
} satisfies ToastPassThroughOptions

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
      --toast-top: ${rect.top + 100}px;
      --toast-right: ${window.innerWidth - (rect.left + rect.width) + 20}px;
    }
  `
}

function createStyleElement() {
  const style = document.createElement('style')
  style.id = 'dynamic-toast-style'
  document.head.appendChild(style)
  return style
}

const toastPositionBatch = createRafBatch(updateToastPosition)
function scheduleToastPositionUpdate() {
  void nextTick(toastPositionBatch.schedule)
}

useEventListener(window, 'resize', scheduleToastPositionUpdate)
onUnmounted(toastPositionBatch.cancel)

watch(() => settingStore.get('Comfy.UseNewMenu'), scheduleToastPositionUpdate, {
  immediate: true
})
watch(
  () => settingStore.get('Comfy.Sidebar.Location'),
  scheduleToastPositionUpdate,
  { immediate: true }
)
</script>
