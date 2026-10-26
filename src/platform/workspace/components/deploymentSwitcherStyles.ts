/** Class for a row of the deployment switcher's list. */
export const switcherItemClass =
  'group min-h-8 gap-2 rounded-sm px-2 py-1 text-xs'

/** Class for the trailing slot each row keeps for its check, chevron or arrow. */
export const switcherTrailingSlotClass = 'flex w-3.5 shrink-0 justify-center'

/** Class for the switcher's menus to fade and scale in and out. */
export const switcherMenuMotionClass =
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95'
