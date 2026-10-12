import type { DialogComponentProps } from '@/stores/dialogStore'

export const LOAD3D_VIEWER_DIALOG_PROPS = {
  renderer: 'reka',
  size: 'full',
  contentClass:
    'w-[80vw] max-w-[min(80vw,calc(100vw-var(--workspace-inset-right,0px)-1rem))] sm:max-w-[min(80vw,calc(100vw-var(--workspace-inset-right,0px)-1rem))] h-[80vh] max-h-[80vh]',
  maximizable: true
} satisfies DialogComponentProps
