/** The Best for and Resolution menus' trigger, panel and rows. */
export const MENU_TRIGGER =
  'group inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl bg-transparency-white-t4 px-3 text-sm font-medium whitespace-nowrap text-primary-comfy-canvas transition-colors outline-none hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 data-[state=open]:bg-transparency-white-t8 max-sm:h-10 max-sm:rounded-xl'

export const MENU_PANEL =
  'z-50 max-h-(--reka-dropdown-menu-content-available-height) w-64 overflow-y-auto rounded-2xl border border-primary-comfy-ink-light bg-site-dropdown p-2 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0'

export const MENU_HEADING =
  'px-3 pt-1 pb-2 text-xs font-semibold tracking-wider text-content-secondary uppercase'

export const MENU_ITEM =
  'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm outline-none select-none'

export const MENU_ITEM_SELECTED = 'bg-transparency-white-t8 text-content-bright'

export const MENU_ITEM_IDLE =
  'text-content-secondary hover:bg-transparency-white-t4 hover:text-content-bright data-highlighted:bg-transparency-white-t4 data-highlighted:text-content-bright'
