import type { CompassCorners } from '@/lib/litegraph/src/interfaces'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

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
    positionClasses: '-right-1 -bottom-1',
    cursorClass: 'cursor-se-resize',
    i18nKey: 'g.resizeFromBottomRight',
    svgPositionClasses: 'top-1 left-1',
    svgTransform: ''
  },
  {
    corner: 'NE',
    positionClasses: '-right-1 -top-1',
    cursorClass: 'cursor-ne-resize',
    i18nKey: 'g.resizeFromTopRight',
    svgPositionClasses: 'bottom-1 left-1',
    svgTransform: 'scaleY(-1)'
  },
  {
    corner: 'SW',
    positionClasses: '-left-1 -bottom-1',
    cursorClass: 'cursor-sw-resize',
    i18nKey: 'g.resizeFromBottomLeft',
    svgPositionClasses: 'top-1 right-1',
    svgTransform: 'scaleX(-1)'
  },
  {
    corner: 'NW',
    positionClasses: '-left-1 -top-1',
    cursorClass: 'cursor-nw-resize',
    i18nKey: 'g.resizeFromTopLeft',
    svgPositionClasses: 'bottom-1 right-1',
    svgTransform: 'scale(-1, -1)'
  }
] as const

export const hasWestEdge = (corner: CompassCorners): boolean =>
  corner === 'SW' || corner === 'NW'

export const hasNorthEdge = (corner: CompassCorners): boolean =>
  corner === 'NE' || corner === 'NW'

/**
 * English aria-labels per corner, resolved once from `en/main.json`.
 * Exposed for E2E tests that run in the English locale and locate handles
 * via `getByRole('button', { name })`. Production renders via `t(i18nKey)`.
 */
export const RESIZE_HANDLE_ARIA_LABELS_EN: Record<CompassCorners, string> =
  Object.fromEntries(
    RESIZE_HANDLES.map((handle) => {
      const [section, key] = handle.i18nKey.split('.') as [
        keyof typeof enMessages,
        string
      ]
      const group = enMessages[section] as Record<string, string> | undefined
      const label = group?.[key]
      if (typeof label !== 'string') {
        throw new Error(
          `Missing English aria-label for resize handle key "${handle.i18nKey}"`
        )
      }
      return [handle.corner, label]
    })
  ) as Record<CompassCorners, string>
