import type { DialogComponentProps } from '@/stores/dialogStore'

export const LAYER_EDITOR_DIALOG_KEY = 'global-layer-editor'

export const layerEditorDialogProps = {
  renderer: 'reka',
  size: 'full',
  contentClass: 'layer-editor-dialog',
  headerClass: 'border-b border-border-default p-2',
  bodyClass: 'flex min-h-0 flex-col p-0',
  modal: true,
  maximizable: false,
  maximized: true,
  closable: false
} satisfies DialogComponentProps
