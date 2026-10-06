import type { DialogComponentProps } from '@/stores/dialogStore'

export const LOAD3D_VIEWER_DIALOG_PROPS = {
  renderer: 'reka',
  size: 'full',
  contentClass: 'w-[80vw] max-w-[80vw] h-[80vh] max-h-[80vh]',
  maximizable: true
} satisfies DialogComponentProps
