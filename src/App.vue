<template>
  <router-view />
  <GlobalDialog />
  <BlockUI full-screen :blocked="isLoading" />
  <div
    v-if="isLoading"
    class="pointer-events-none fixed inset-0 z-1200 flex items-center justify-center"
  >
    <LogoComfyWaveLoader size="xl" color="yellow" />
  </div>
</template>

<script setup lang="ts">
import { captureException } from '@sentry/vue'
import BlockUI from 'primevue/blockui'
import { computed, onMounted } from 'vue'

import LogoComfyWaveLoader from '@/components/loader/LogoComfyWaveLoader.vue'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import config from '@/config'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useConflictDetection } from '@/workbench/extensions/manager/composables/useConflictDetection'

import { electronAPI } from '@/utils/envUtil'
import { isDesktop } from '@/platform/distribution/types'
import { app } from '@/scripts/app'

const workspaceStore = useWorkspaceStore()
app.extensionManager = useWorkspaceStore()

const conflictDetection = useConflictDetection()
const isLoading = computed<boolean>(() => workspaceStore.spinner)

const showContextMenu = (event: MouseEvent) => {
  const { target } = event
  switch (true) {
    case target instanceof HTMLTextAreaElement:
    case target instanceof HTMLInputElement && target.type === 'text':
      // TODO: Context input menu explicitly for text input
      electronAPI()?.showContextMenu({ type: 'text' })
      return
  }
}

onMounted(() => {
  window['__COMFYUI_FRONTEND_VERSION__'] = config.app_version

  if (isDesktop) {
    document.addEventListener('contextmenu', showContextMenu)
  }

  // Handle preload errors that occur during dynamic imports (e.g., stale chunks after deployment)
  // See: https://vite.dev/guide/build#load-error-handling
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    if (__DISTRIBUTION__ === 'cloud') {
      captureException(event.payload, {
        tags: { error_type: 'vite_preload_error' }
      })
    } else {
      console.error('[vite:preloadError]', event.payload)
    }
  })

  // Initialize conflict detection in background
  // This runs async and doesn't block UI setup
  void conflictDetection.initializeConflictDetection()
})
</script>
