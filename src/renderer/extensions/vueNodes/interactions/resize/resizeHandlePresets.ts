import type { ResizeHandleDirection } from '@/renderer/extensions/vueNodes/interactions/resize/resizeMath'

/**
 * Shared resize handle definitions for corner handles.
 */
export const cornerResizeHandles = Object.freeze([
  {
    id: 'se',
    direction: { horizontal: 'right', vertical: 'bottom' },
    classes: 'right-0 bottom-0 cursor-se-resize'
  },
  {
    id: 'ne',
    direction: { horizontal: 'right', vertical: 'top' },
    classes: 'right-0 top-0 cursor-ne-resize'
  },
  {
    id: 'sw',
    direction: { horizontal: 'left', vertical: 'bottom' },
    classes: 'left-0 bottom-0 cursor-sw-resize'
  },
  {
    id: 'nw',
    direction: { horizontal: 'left', vertical: 'top' },
    classes: 'left-0 top-0 cursor-nw-resize'
  }
] satisfies ReadonlyArray<{
  id: string
  direction: ResizeHandleDirection
  classes: string
}>)
