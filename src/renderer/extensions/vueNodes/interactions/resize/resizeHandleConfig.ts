import type { CompassCorners } from '@/lib/litegraph/src/interfaces'

interface ResizeHandle {
  readonly corner: CompassCorners
  readonly positionClasses: string
  readonly cursorClass: string
  readonly i18nKey: string
  readonly svgPositionClasses: string
  readonly svgTransform: string
}

export const RESIZE_HANDLES: ResizeHandle[] = [
  {
    corner: 'SE',
    positionClasses: '-right-3 -bottom-3',
    cursorClass: 'cursor-se-resize',
    i18nKey: 'g.resizeFromBottomRight',
    svgPositionClasses: 'top-0 left-0',
    svgTransform: ''
  },
  {
    corner: 'NE',
    positionClasses: '-right-3 -top-3',
    cursorClass: 'cursor-ne-resize',
    i18nKey: 'g.resizeFromTopRight',
    svgPositionClasses: 'bottom-0 left-0',
    svgTransform: 'scaleY(-1)'
  },
  {
    corner: 'SW',
    positionClasses: '-left-3 -bottom-3',
    cursorClass: 'cursor-sw-resize',
    i18nKey: 'g.resizeFromBottomLeft',
    svgPositionClasses: 'top-0 right-0',
    svgTransform: 'scaleX(-1)'
  },
  {
    corner: 'NW',
    positionClasses: '-left-3 -top-3',
    cursorClass: 'cursor-nw-resize',
    i18nKey: 'g.resizeFromTopLeft',
    svgPositionClasses: 'bottom-0 right-0',
    svgTransform: 'scale(-1, -1)'
  }
] as const

/** True for corners on the left edge of a node (SW, NW) — these move the x-origin when dragged. */
export const hasWestEdge = (corner: CompassCorners): boolean =>
  corner === 'SW' || corner === 'NW'

/** True for corners on the top edge of a node (NE, NW) — these move the y-origin when dragged. */
export const hasNorthEdge = (corner: CompassCorners): boolean =>
  corner === 'NE' || corner === 'NW'
