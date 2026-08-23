import { cn } from '@comfyorg/tailwind-utils'

export const chipClass =
  'flex shrink-0 items-center gap-1.5 rounded-lg border-0 bg-interface-menu-surface px-2.5 py-1 text-sm text-base-foreground outline-none transition-colors hover:bg-button-active-surface focus-visible:ring-1 focus-visible:ring-ring'

export const iconBtnClass =
  'flex size-8 items-center justify-center rounded-md border-0 bg-transparent text-base-foreground outline-none transition-colors hover:bg-button-hover-surface focus-visible:ring-1 focus-visible:ring-ring'

export const panelClass =
  'w-48 max-h-80 overflow-y-auto flex flex-col gap-0.5 p-1.5 rounded-lg border-border-default bg-interface-menu-surface shadow-interface'

export const rowClass =
  'flex w-full cursor-pointer items-center rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-sm text-base-foreground outline-none hover:bg-button-hover-surface focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset'

export function actionClass(active: boolean) {
  return cn(
    'focus-visible:ring-ring flex shrink-0 items-center gap-1.5 rounded-md border-0 bg-transparent px-2 py-1 text-sm text-base-foreground transition-colors outline-none hover:bg-button-hover-surface focus-visible:ring-1',
    active && 'bg-button-active-surface'
  )
}

export function tip(label: string) {
  return { value: label, showDelay: 300 }
}
