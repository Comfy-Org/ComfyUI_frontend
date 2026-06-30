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
    // Reka renderer — the legacy PrimeVue confirm dialog's enter-transition is flaky.
    dialogComponentProps: {
      renderer: 'reka'
    }
  })
}
