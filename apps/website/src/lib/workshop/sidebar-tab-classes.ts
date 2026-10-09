/**
 * The Hub catalogues' category sidebar: a row of pills on a narrow screen and
 * a column of entries with counts beside the grid from `lg` up. Models and
 * Workflows share it so a category looks the same on either page.
 */
export const SIDEBAR_FRAME =
  '-mx-1 mb-8 overflow-x-auto px-1 py-1 max-sm:mb-4 lg:mx-0 lg:mb-0 lg:overflow-visible lg:px-0 lg:pt-4'

export const SIDEBAR_LIST =
  'inline-flex items-center gap-0.5 rounded-full bg-hub-surface p-1 lg:flex lg:flex-col lg:items-stretch lg:gap-6 lg:rounded-none lg:bg-transparent lg:p-0'

export const SIDEBAR_TAB =
  'inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium whitespace-nowrap text-primary-comfy-canvas transition-colors outline-none hover:bg-transparency-white-t4 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 lg:w-full lg:gap-2.5 lg:rounded-xl lg:text-sm'

export const SIDEBAR_TAB_SELECTED =
  'bg-transparency-white-t8 font-semibold text-primary-warm-white hover:bg-transparency-white-t8'

export const SIDEBAR_ICON =
  'size-3.5 shrink-0 text-primary-warm-white lg:size-4'

export const SIDEBAR_LABEL = 'lg:min-w-0 lg:flex-1 lg:truncate lg:text-left'

export const SIDEBAR_COUNT =
  'text-[13px] font-medium text-primary-warm-gray tabular-nums'

export function sidebarTargetIndex(
  key: string,
  index: number,
  length: number,
  vertical: boolean
): number | undefined {
  switch (key) {
    case 'Home':
      return 0
    case 'End':
      return length - 1
    case vertical ? 'ArrowUp' : 'ArrowLeft':
      return (index - 1 + length) % length
    case vertical ? 'ArrowDown' : 'ArrowRight':
      return (index + 1) % length
    default:
      return undefined
  }
}
