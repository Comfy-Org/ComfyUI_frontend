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
    positionClasses: 'right-0 bottom-0',
    cursorClass: 'cursor-se-resize',
    i18nKey: 'g.resizeFromBottomRight',
    svgPositionClasses: 'right-0 bottom-0',
    svgTransform: ''
  },
  {
    corner: 'NE',
    positionClasses: 'right-0 top-0',
    cursorClass: 'cursor-ne-resize',
    i18nKey: 'g.resizeFromTopRight',
    svgPositionClasses: 'top-0 right-0',
    svgTransform: 'scaleY(-1)'
  },
  {
    corner: 'SW',
    positionClasses: 'bottom-0 left-0',
    cursorClass: 'cursor-sw-resize',
    i18nKey: 'g.resizeFromBottomLeft',
    svgPositionClasses: 'bottom-0 left-0',
    svgTransform: 'scaleX(-1)'
  },
  {
    corner: 'NW',
    positionClasses: 'top-0 left-0',
    cursorClass: 'cursor-nw-resize',
    i18nKey: 'g.resizeFromTopLeft',
    svgPositionClasses: 'top-0 left-0',
    svgTransform: 'scale(-1, -1)'
  }
] as const

/** True for corners on the left edge of a node (SW, NW) — these move the x-origin when dragged. */
export const hasWestEdge = (corner: CompassCorners): boolean =>
  corner === 'SW' || corner === 'NW'

/** True for corners on the top edge of a node (NE, NW) — these move the y-origin when dragged. */
export const hasNorthEdge = (corner: CompassCorners): boolean =>
  corner === 'NE' || corner === 'NW'
