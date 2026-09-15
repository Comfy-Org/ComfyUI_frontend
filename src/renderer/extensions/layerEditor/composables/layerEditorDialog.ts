import { defineAsyncComponent } from 'vue'

import type { DialogComponentProps } from '@/stores/dialogStore'

export const LAYER_EDITOR_DIALOG_KEY = 'global-layer-editor'

export const LayerEditorDialogContent = defineAsyncComponent(
  () =>
    import('@/renderer/extensions/layerEditor/components/LayerEditorContent.vue')
)

export const LayerEditorDialogHeader = defineAsyncComponent(
  () =>
    import('@/renderer/extensions/layerEditor/components/dialog/TopBarHeader.vue')
)

export const layerEditorDialogProps = {
  renderer: 'reka',
  size: 'full',
  headerClass: 'border-b border-border-default p-2',
  bodyClass: 'flex min-h-0 flex-col p-0',
  modal: true,
  maximizable: false,
  maximized: true,
  closable: true,
  showCloseButton: false,
  dismissableMask: false
} satisfies DialogComponentProps
