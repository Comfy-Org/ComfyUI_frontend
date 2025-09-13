<template>
  <Toast />
</template>

<script setup lang="ts">
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { nextTick, watch } from 'vue'

import { useSettingStore } from '@/stores/settingStore'
import { useToastStore } from '@/stores/toastStore'

const toast = useToast()
const toastStore = useToastStore()
const settingStore = useSettingStore()

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
      top: ${rect.top + 20}px !important;
      right: ${window.innerWidth - (rect.left + rect.width) + 20}px !important;
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
