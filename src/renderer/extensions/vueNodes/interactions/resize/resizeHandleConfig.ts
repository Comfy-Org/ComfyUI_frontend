import type { CompassCorners } from '@comfyorg/shared-frontend-utils/geometry'

export interface ResizeHandle {
  readonly corner: CompassCorners
  readonly positionClasses: string
  readonly cursorClass: string
  readonly i18nKey: string
  readonly svgPositionClasses: string
}

export const RESIZE_HANDLES: ResizeHandle[] = [
  {
    corner: 'SE',
    positionClasses: '-right-1 -bottom-1',
    cursorClass: 'cursor-se-resize',
    i18nKey: 'g.resizeFromBottomRight',
    svgPositionClasses: 'top-1 left-1'
  },
  {
    corner: 'NE',
    positionClasses: '-right-1 -top-1',
    cursorClass: 'cursor-ne-resize',
    i18nKey: 'g.resizeFromTopRight',
    svgPositionClasses: 'bottom-1 left-1 -scale-y-100'
  },
  {
    corner: 'SW',
    positionClasses: '-left-1 -bottom-1',
    cursorClass: 'cursor-sw-resize',
    i18nKey: 'g.resizeFromBottomLeft',
    svgPositionClasses: 'top-1 right-1 -scale-x-100'
  },
  {
    corner: 'NW',
    positionClasses: '-left-1 -top-1',
    cursorClass: 'cursor-nw-resize',
    i18nKey: 'g.resizeFromTopLeft',
    svgPositionClasses: 'bottom-1 right-1 -scale-100'
  }
] as const
