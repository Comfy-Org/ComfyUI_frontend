<template>
  <router-view />
  <ProgressSpinner
    v-if="isLoading"
    class="absolute inset-0 flex justify-center items-center h-screen"
  />
  <GlobalDialog />
  <BlockUI full-screen :blocked="isLoading" />
  <Toast />
</template>

<script setup lang="ts">
import config from '@/config'
import { computed, onMounted } from 'vue'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import BlockUI from 'primevue/blockui'
import ProgressSpinner from 'primevue/progressspinner'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { useEventListener } from '@vueuse/core'
import { electronAPI, isElectron } from './utils/envUtil'
import { useToast } from 'primevue/usetoast'
import Toast, { ToastMessageOptions } from 'primevue/toast'

const toast = useToast()
const workspaceStore = useWorkspaceStore()
const isLoading = computed<boolean>(() => workspaceStore.spinner)
const handleKey = (e: KeyboardEvent) => {
  workspaceStore.shiftDown = e.shiftKey
}
useEventListener(window, 'keydown', handleKey)
useEventListener(window, 'keyup', handleKey)

onMounted(() => {
  window['__COMFYUI_FRONTEND_VERSION__'] = config.app_version
  console.log('ComfyUI Front-end version:', config.app_version)

  if (isElectron()) {
    const electron = electronAPI()
    electron['onShowToast']((config: ToastMessageOptions) => {
      toast.add(config)
    })
    electron['loaded']()
  }
})
</script>
