import ConfirmBody from '@/components/dialog/confirm/ConfirmBody.vue'
import ConfirmFooter from '@/components/dialog/confirm/ConfirmFooter.vue'
import ConfirmHeader from '@/components/dialog/confirm/ConfirmHeader.vue'
import { useDialogStore } from '@/stores/dialogStore'
import type { ComponentAttrs } from 'vue-component-type-helpers'

interface ConfirmDialogOptions {
  key?: string
  headerProps?: ComponentAttrs<typeof ConfirmHeader>
  props?: ComponentAttrs<typeof ConfirmBody>
  footerProps?: ComponentAttrs<typeof ConfirmFooter>
}

export function showConfirmDialog(options: ConfirmDialogOptions = {}) {
  const dialogStore = useDialogStore()
  const { key, headerProps, props, footerProps } = options
  return dialogStore.showDialog({
    key,
    headerComponent: ConfirmHeader,
    component: ConfirmBody,
    footerComponent: ConfirmFooter,
    headerProps,
    props,
    footerProps,
    // Render confirm dialogs via Reka. The legacy PrimeVue confirm dialog has a
    // latent-flaky enter-transition that becomes deterministic under the heavier
    // cloud init (FE-978), hanging the e2e confirm interactions. The Reka
    // Confirm{Header,Body,Footer} components own their padding, so the PrimeVue
    // `pt` zeroing is no longer needed.
    dialogComponentProps: {
      renderer: 'reka'
    }
  })
}
