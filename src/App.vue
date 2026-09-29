<template>
  <router-view />
  <GlobalDialog />
  <div
    v-show="isLoading"
    ref="loadingOverlay"
    data-testid="app-loading-overlay"
    class="fixed inset-0 bg-black/10"
    :aria-busy="isLoading"
  />
</template>

<script setup lang="ts">
import { ZIndex } from '@primeuix/utils/zindex'
import {
  computed,
  onMounted,
  useTemplateRef,
  watch,
  watchPostEffect
} from 'vue'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { MODAL_Z_BASE, MODAL_Z_KEY } from '@/components/dialog/vRekaZIndex'
import config from '@/config'
import { isDesktop } from '@/platform/distribution/types'
import {
  reportPreloadError,
  reportResourceLoadError
} from '@/platform/telemetry/assetLoadErrorReporting'
import { app } from '@/scripts/app'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { electronAPI } from '@/utils/envUtil'
import { useConflictDetection } from '@/workbench/extensions/manager/composables/useConflictDetection'

const workspaceStore = useWorkspaceStore()
app.extensionManager = useWorkspaceStore()

const conflictDetection = useConflictDetection()
const isLoading = computed<boolean>(() => workspaceStore.spinner)
const loadingOverlay = useTemplateRef<HTMLDivElement>('loadingOverlay')

watchPostEffect((onCleanup) => {
  const overlay = loadingOverlay.value
  if (!isLoading.value || !overlay) return

  ZIndex.set(MODAL_Z_KEY, overlay, MODAL_Z_BASE)
  onCleanup(() => ZIndex.clear(overlay))
})

watch(
  isLoading,
  (loading, prevLoading) => {
    if (prevLoading && !loading) {
      document.getElementById('splash-loader')?.remove()
    }
  },
  { flush: 'post' }
)

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
    reportPreloadError(event.payload)
    // Disabled: Third-party custom node extensions frequently trigger this toast
    // (e.g., bare "vue" imports, wrong relative paths to scripts/app.js, missing
    // core dependencies). These are plugin bugs, not ComfyUI core failures, but
    // the generic error message alarms users and offers no actionable guidance.
    // The reporter above still logs the details for developers to debug.
    // useToastStore().add({
    //   severity: 'error',
    //   summary: t('g.preloadErrorTitle'),
    //   detail: t('g.preloadError'),
    //   life: 10000
    // })
  })

  // Capture resource load failures (CSS, scripts) in non-localhost distributions
  if (__DISTRIBUTION__ !== 'localhost') {
    window.addEventListener(
      'error',
      (event) => {
        const target = event.target
        if (target instanceof HTMLScriptElement) {
          reportResourceLoadError(target.src, 'script')
        } else if (
          target instanceof HTMLLinkElement &&
          target.rel === 'stylesheet'
        ) {
          reportResourceLoadError(target.href, 'link')
        }
      },
      true
    )
  }

  // Initialize conflict detection in background
  // This runs async and doesn't block UI setup
  void conflictDetection.initializeConflictDetection()
})
</script>
