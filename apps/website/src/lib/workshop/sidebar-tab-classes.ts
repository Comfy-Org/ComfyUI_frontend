import type { Component } from 'vue'

/**
 * The Hub catalogues' category sidebar: a row of underlined tabs on a narrow
 * screen and a column of entries with counts beside the grid from `lg` up. Models and
 * Workflows share it so a category looks the same on either page.
 */
export const SIDEBAR_FRAME =
  '-mx-1 mb-8 overflow-x-auto px-1 py-1 max-sm:mb-4 lg:mx-0 lg:mb-0 lg:overflow-visible lg:px-0 lg:pt-4'

export const SIDEBAR_LIST =
  'flex min-w-max items-end gap-6 border-b border-transparency-white-t8 lg:min-w-0 lg:flex-col lg:items-stretch lg:border-b-0'

export const SIDEBAR_TAB =
  '-mb-px inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 border-b-2 border-transparent text-sm font-medium whitespace-nowrap text-primary-comfy-canvas transition-colors outline-none hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 lg:mb-0 lg:h-auto lg:min-h-11 lg:w-full lg:gap-2.5 lg:rounded-xl lg:border-b-0 lg:px-3 lg:py-2 lg:whitespace-normal lg:hover:bg-transparency-white-t4'

export const SIDEBAR_TAB_SELECTED =
  'border-primary-warm-white font-semibold text-primary-warm-white lg:bg-transparency-white-t8 lg:hover:bg-transparency-white-t8'

export const SIDEBAR_TAB_NESTED =
  'lg:relative lg:ml-8 lg:w-auto lg:before:absolute lg:before:-inset-y-px lg:before:-left-3 lg:before:w-px lg:before:bg-transparency-white-t20'

export const SIDEBAR_TAB_NESTED_SELECTED = 'lg:before:bg-primary-warm-white'

export const SIDEBAR_ICON =
  'size-4 shrink-0 text-primary-warm-white max-lg:hidden'

export const SIDEBAR_LABEL = 'lg:min-w-0 lg:flex-1 lg:text-left'

export const SIDEBAR_COUNT =
  'text-[13px] font-medium text-primary-warm-gray tabular-nums max-lg:hidden'

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

/** One row of a Hub catalogue sidebar. */
export interface SidebarChoice<Key extends string> {
  readonly key: Key
  readonly label: string
  readonly count: number
  /** Left out on a row nested under the one before it. */
  readonly icon?: Component
  /** A row listed under the one before it, such as a task under its type. */
  readonly nested?: boolean
}
