import ConfirmBody from '@comfyorg/design-system/confirm/ConfirmBody'
import ConfirmFooter from '@comfyorg/design-system/confirm/ConfirmFooter'
import ConfirmHeader from '@comfyorg/design-system/confirm/ConfirmHeader'
import { t } from '@/i18n'
import type { DialogInstance } from '@/stores/dialogStore'
import { useDialogStore } from '@/stores/dialogStore'
import type { ComponentAttrs } from 'vue-component-type-helpers'

interface ConfirmDialogOptions {
  key?: string
  headerProps?: ComponentAttrs<typeof ConfirmHeader>
  props?: ComponentAttrs<typeof ConfirmBody>
  footerProps?: Partial<ComponentAttrs<typeof ConfirmFooter>>
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
    footerProps: {
      ...footerProps,
      confirmText: footerProps?.confirmText || t('g.confirm'),
      cancelText: footerProps?.cancelText || t('g.cancel')
    },
    dialogComponentProps: {
      flush: true
    }
  })
}
