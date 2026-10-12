import { cn } from '@comfyorg/tailwind-utils'

import { menuContentClass } from '@/components/ui/menu/menuStyles'

export const chipClass =
  'shrink-0 gap-1.5 rounded-lg bg-interface-menu-surface px-2.5 py-1 hover:bg-button-active-surface'

export const formPanelClass =
  'w-48 max-h-80 overflow-y-auto flex flex-col gap-0.5 p-1.5 rounded-lg border-border-default bg-interface-menu-surface shadow-interface'

export const menuPanelClass = cn(
  menuContentClass,
  'flex max-h-80 w-48 flex-col'
)

export function actionClass(active: boolean) {
  return cn('shrink-0 gap-1.5 px-2 py-1', active && 'bg-button-active-surface')
}
