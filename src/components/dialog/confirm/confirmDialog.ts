import ConfirmBody from '@comfyorg/design-system/confirm/ConfirmBody'
import ConfirmFooter from '@/components/dialog/confirm/ConfirmFooter.vue'
import ConfirmHeader from '@comfyorg/design-system/confirm/ConfirmHeader'
import type { DialogInstance } from '@/stores/dialogStore'
import { useDialogStore } from '@/stores/dialogStore'
import type { ComponentAttrs } from 'vue-component-type-helpers'

interface ConfirmDialogOptions {
  key?: string
  headerProps?: ComponentAttrs<typeof ConfirmHeader>
  props?: ComponentAttrs<typeof ConfirmBody>
  footerProps?: ComponentAttrs<typeof ConfirmFooter>
}

export function showConfirmDialog(
  options: ConfirmDialogOptions = {}
): DialogInstance {
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
    dialogComponentProps: {
      flush: true
    }
  })
}
