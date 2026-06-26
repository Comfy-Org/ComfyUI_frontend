import type { MenuSize } from './menu.context'

export const menuContentClasses =
  'z-1000 min-w-56 overflow-hidden rounded-lg border border-border-subtle bg-base-background p-1 text-base-foreground shadow-interface outline-none ' +
  'data-[state=closed]:animate-out data-[state=open]:animate-in ' +
  'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ' +
  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ' +
  'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 ' +
  'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'

const menuItemBase =
  'relative flex w-full shrink-0 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-left leading-normal text-base-foreground outline-none ' +
  'data-[highlighted]:bg-secondary-background ' +
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50'

const menuItemDefaultClasses = `${menuItemBase} h-7 text-xs`
const menuItemLgClasses = `${menuItemBase} h-8 text-sm`

export function menuItemClassesFor(size: MenuSize): string {
  return size === 'lg' ? menuItemLgClasses : menuItemDefaultClasses
}

const menuItemLeadingBase =
  'flex shrink-0 items-center justify-center text-muted-foreground'

const menuItemLeadingDefaultClasses = `${menuItemLeadingBase} size-3.5 [&>i]:size-3.5`
const menuItemLeadingLgClasses = `${menuItemLeadingBase} size-4 [&>i]:size-4`

export function menuItemLeadingClassesFor(size: MenuSize): string {
  return size === 'lg'
    ? menuItemLeadingLgClasses
    : menuItemLeadingDefaultClasses
}

export const menuItemDestructiveClasses =
  'data-[highlighted]:text-destructive-background data-[highlighted]:[&>span]:text-destructive-background'

export const menuSeparatorClasses = '-mx-1 my-1 h-px bg-border-subtle'

export const menuLabelClasses =
  'px-2 py-1.5 text-xs font-medium text-text-subtle'

export const menuShortcutClasses =
  'ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border-subtle px-1 text-xs text-muted-foreground'

export function trailingIconSizeClass(size: MenuSize): string {
  return size === 'lg' ? 'size-4' : 'size-3.5'
}
