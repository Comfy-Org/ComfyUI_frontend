import { useRafFn } from '@vueuse/core'
import { nextTick } from 'vue'

import AssetBrowserModal from '@/platform/assets/components/AssetBrowserModal.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import { type DialogComponentProps, useDialogStore } from '@/stores/dialogStore'

interface AssetBrowserDialogProps {
  /** ComfyUI node type for context (e.g., 'CheckpointLoaderSimple') */
  nodeType: string
  /** Widget input name (e.g., 'ckpt_name') */
  inputName: string
  /** Current selected asset value */
  currentValue?: string
  /**
   * Callback for when an asset is selected
   * @param {string} filename - The validated filename from user_metadata.filename
   */
  onAssetSelected?: (filename: string) => void
}

export const useAssetBrowserDialog = () => {
  const dialogStore = useDialogStore()
  const dialogKey = 'global-asset-browser'
  let onHideComplete: (() => void) | null = null

  /**
   * Why we need Promise coordination with PrimeVue's onAfterHide:
   *
   * PrimeVue Dialog uses Vue's <transition> with specific animation lifecycle hooks.
   * Source: https://github.com/primefaces/primevue/blob/72590856123052fa798b185dc2c88928a325258f/packages/primevue/src/dialog/Dialog.vue#L3-L4
   *
   * The animation flow is:
   * 1. visible=false triggers @leave event
   *    https://github.com/primefaces/primevue/blob/72590856123052fa798b185dc2c88928a325258f/packages/primevue/src/dialog/Dialog.vue#L162-L170
   * 2. CSS animation runs (~300ms)
   * 3. @after-leave fires, emitting 'after-hide'
   *    https://github.com/primefaces/primevue/blob/72590856123052fa798b185dc2c88928a325258f/packages/primevue/src/dialog/Dialog.vue#L171-L180
   *
   * Why Vue/VueUse lifecycle hooks cannot manage this:
   *
   * - Vue's onBeforeUnmount/onUnmounted track COMPONENT lifecycle (mounting/unmounting)
   *   Source: https://github.com/vuejs/core/blob/928af5fe2f5f366b5c28b8549c3728735c8d8318/packages/runtime-core/src/apiLifecycle.ts#L91-94
   *   These only fire when a component is being destroyed, not during visibility changes
   *
   * - VueUse's tryOnUnmounted only fires when component unmounts
   *   Source: https://github.com/vueuse/vueuse/blob/cf905ccfb5dd7a6a3e65aa087a034b5157c9f9fb/packages/shared/tryOnUnmounted/index.ts
   *   It checks getLifeCycleTarget() and registers onUnmounted, but component remains mounted during animation
   *
   * - The Dialog component remains mounted during animation - only visibility changes
   * - CSS transitions are managed by the browser, not Vue's reactivity system
   * - Only PrimeVue's onAfterHide callback knows when the CSS animation completes
   *
   * Without Promise coordination, calling hide() synchronously after widget update
   * causes both operations in the same event tick, preventing proper animation.
   *
   * Why nextTick() doesn't solve this:
   * - nextTick() only defers to the next microtask, not the next animation frame
   * - PrimeVue's animation timing depends on CSS transition duration (~300ms)
   * - We need to wait for the actual animation completion, not just DOM updates
   * - Only onAfterHide callback provides the correct timing signal
   */
  function hide(): Promise<void> {
    return new Promise((resolve) => {
      onHideComplete = resolve
      dialogStore.animateHide({ key: dialogKey })
    })
  }

  async function show(props: AssetBrowserDialogProps) {
    const handleAssetSelected = async (filename: string) => {
      // This function is called by selectAssetWithCallback with the validated filename
      props.onAssetSelected?.(filename)

      // Wait for Vue to flush all synchronous updates (widget value, DOM updates)
      await nextTick()

      // Wait for next animation frame when PrimeVue sets up animation state
      return new Promise<void>((resolve) => {
        const { pause } = useRafFn(
          () => {
            pause()
            void hide().then(resolve)
          },
          { immediate: true }
        )
      })
    }
    const dialogComponentProps: DialogComponentProps = {
      headless: true,
      modal: true,
      closable: true,
      onAfterHide: () => {
        // Resolve the hide() promise when animation completes
        if (!onHideComplete) return

        onHideComplete()
        onHideComplete = null
      },
      pt: {
        root: {
          class: 'rounded-2xl overflow-hidden asset-browser-dialog'
        },
        header: {
          class: 'p-0 hidden'
        },
        content: {
          class: 'p-0 m-0 h-full w-full'
        }
      }
    }

    const assets: AssetItem[] = await assetService
      .getAssetsForNodeType(props.nodeType)
      .catch((error) => {
        console.error(
          'Failed to fetch assets for node type:',
          props.nodeType,
          error
        )
        return []
      })

    dialogStore.showDialog({
      key: dialogKey,
      component: AssetBrowserModal,
      props: {
        nodeType: props.nodeType,
        inputName: props.inputName,
        currentValue: props.currentValue,
        assets,
        onSelect: handleAssetSelected,
        onClose: () => hide()
      },
      dialogComponentProps
    })
  }

  return { show, hide }
}
