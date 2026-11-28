import type { ThemeTokens } from './themePresetSchema'

/** Vue node geometry, in CSS px, read from a theme's `node-*` tokens. */
export interface NodeGeometry {
  headerHeight: number
  slotInset: number
  slotBlockMarginBottom: number
  socketRowOverlap: number
}

/** The node geometry a theme's resolved tokens describe; each token holds a px length. */
export function nodeGeometryOf(tokens: ThemeTokens): NodeGeometry {
  return {
    headerHeight: parseFloat(tokens['node-header-height'] ?? ''),
    slotInset: parseFloat(tokens['node-slot-inset'] ?? ''),
    slotBlockMarginBottom: parseFloat(
      tokens['node-slot-block-margin-bottom'] ?? ''
    ),
    socketRowOverlap: parseFloat(tokens['node-socket-row-overlap'] ?? '')
  }
}
