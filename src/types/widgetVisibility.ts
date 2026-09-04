/**
 * Widget visibility as a data-oriented component (ADR 0003/0008).
 *
 * Static, registration-time policy lives in {@link WidgetDisplay}: one tier
 * per rendering surface. Dynamic, runtime state lives in
 * {@link WidgetSuppression}: orthogonal boolean reasons a widget is currently
 * not rendered anywhere. Surfaces resolve visibility with
 * {@link isWidgetVisibleOnSurface}; legacy `hidden` / `hideInPanel` /
 * `advanced` / `canvasOnly` fields are facades over this component.
 */

export const WIDGET_SURFACES = ['canvas', 'vueNode', 'panel'] as const

export type WidgetSurface = (typeof WIDGET_SURFACES)[number]

type WidgetDisplayTier = 'shown' | 'advanced' | 'never'

export type WidgetDisplay = Record<WidgetSurface, WidgetDisplayTier>

interface WidgetSuppression {
  byExtension: boolean
  byConnection: boolean
}

export interface WidgetVisibilityComponent {
  display: WidgetDisplay
  suppression: WidgetSuppression
}

export interface WidgetDisplaySource {
  type: string
  hidden?: boolean
  advanced?: boolean
  options?: {
    hidden?: boolean
    advanced?: boolean
    canvasOnly?: boolean
    hideInPanel?: boolean
  }
}

export function isLegacyHiddenWidgetType(
  type: string | null | undefined
): boolean {
  if (!type) return false
  const normalized = type.toLowerCase()
  return normalized.includes('hidden') || normalized.startsWith('tschide')
}

export function isLegacyWidgetHidingType(
  type: string | null | undefined
): boolean {
  if (!type) return false
  return (
    isLegacyHiddenWidgetType(type) ||
    type === 'converted-widget' ||
    type.startsWith('converted-widget:')
  )
}

/**
 * Registration `advanced` metadata (`options.advanced`) gates only the Vue
 * node and panel surfaces: the legacy canvas has no advanced section, so it
 * renders spec-advanced widgets as plain rows. Only the runtime
 * `widget.advanced` property (an extension write) gates the canvas surface.
 */
export function deriveWidgetDisplay(
  source: WidgetDisplaySource
): WidgetDisplay {
  const canvas: WidgetDisplayTier = source.advanced ? 'advanced' : 'shown'
  const specTier: WidgetDisplayTier =
    (source.options?.advanced ?? source.advanced) ? 'advanced' : 'shown'
  const vueNode: WidgetDisplayTier = source.options?.canvasOnly
    ? 'never'
    : specTier
  return {
    canvas,
    vueNode,
    panel: source.options?.hideInPanel ? 'never' : vueNode
  }
}

export function deriveWidgetVisibility(
  source: WidgetDisplaySource
): WidgetVisibilityComponent {
  const hidden =
    source.hidden ??
    source.options?.hidden ??
    isLegacyHiddenWidgetType(source.type)
  return {
    display: deriveWidgetDisplay(source),
    suppression: { byExtension: hidden, byConnection: false }
  }
}

function isTierVisible(
  tier: WidgetDisplayTier,
  view: { showAdvanced: boolean }
): boolean {
  switch (tier) {
    case 'shown':
      return true
    case 'advanced':
      return view.showAdvanced
    case 'never':
      return false
    default: {
      const unreachable: never = tier
      return unreachable
    }
  }
}

export function isWidgetVisibleOnSurface(
  visibility: WidgetVisibilityComponent,
  surface: WidgetSurface,
  view: { showAdvanced: boolean }
): boolean {
  const { display, suppression } = visibility
  if (suppression.byExtension || suppression.byConnection) return false
  return isTierVisible(display[surface], view)
}

/**
 * Whether the widget keeps its legacy-canvas layout row. A
 * connection-suppressed widget renders no control but still occupies its row,
 * anchoring the connected input slot dot and the widget name.
 */
export function occupiesCanvasRow(
  visibility: WidgetVisibilityComponent,
  view: { showAdvanced: boolean }
): boolean {
  if (visibility.suppression.byExtension) return false
  return (
    visibility.suppression.byConnection ||
    isTierVisible(visibility.display.canvas, view)
  )
}

function isNeverShown(display: WidgetDisplay): boolean {
  return (
    display.canvas === 'never' &&
    display.vueNode === 'never' &&
    display.panel === 'never'
  )
}

/** Legacy `widget.hidden` read: suppressed, or statically hidden everywhere. */
export function isWidgetHidden(visibility: WidgetVisibilityComponent): boolean {
  return (
    visibility.suppression.byExtension ||
    visibility.suppression.byConnection ||
    isNeverShown(visibility.display)
  )
}

/** Legacy `options.hideInPanel` read. */
export function isWidgetHiddenInPanel(
  visibility: WidgetVisibilityComponent
): boolean {
  return visibility.display.panel === 'never'
}

/**
 * Legacy `options.hideInPanel` write. Un-hiding restores the panel to the
 * vueNode tier, which is the panel's baseline before `hideInPanel` applies.
 */
export function setWidgetHiddenInPanel(
  visibility: WidgetVisibilityComponent,
  hidden: boolean
): void {
  visibility.display.panel = hidden ? 'never' : visibility.display.vueNode
}

/** Legacy `widget.advanced` read: any surface gated behind the advanced toggle. */
export function isWidgetAdvanced(
  visibility: WidgetVisibilityComponent
): boolean {
  const { canvas, vueNode, panel } = visibility.display
  return canvas === 'advanced' || vueNode === 'advanced' || panel === 'advanced'
}

/**
 * Legacy `widget.advanced` write: toggles shown ⇄ advanced on the given
 * surfaces, never touches `never`.
 */
export function setWidgetAdvanced(
  visibility: WidgetVisibilityComponent,
  advanced: boolean,
  surfaces: readonly WidgetSurface[] = WIDGET_SURFACES
): void {
  const from: WidgetDisplayTier = advanced ? 'shown' : 'advanced'
  const to: WidgetDisplayTier = advanced ? 'advanced' : 'shown'
  const { display } = visibility
  for (const surface of surfaces) {
    if (display[surface] === from) display[surface] = to
  }
}

/**
 * Legacy `widget.hidden` write. All legacy hiding — registration metadata,
 * legacy hidden type markers, and runtime extension writes — is extension
 * suppression, so un-hiding restores the widget's static display tiers.
 */
export function applyLegacyHiddenWrite(
  visibility: WidgetVisibilityComponent,
  hidden: boolean
): void {
  visibility.suppression.byExtension = hidden
}

export function applyLegacyCanvasOnlyWrite(
  visibility: WidgetVisibilityComponent,
  source: WidgetDisplaySource
): void {
  const { vueNode, panel } = deriveWidgetDisplay({
    ...source,
    advanced: visibility.display.canvas === 'advanced'
  })
  visibility.display.vueNode = vueNode
  visibility.display.panel = panel
}

/**
 * Legacy runtime `widget.advanced` write. Runtime writes always gate the
 * canvas surface; they reach the Vue node and panel surfaces only when
 * registration metadata (`options.advanced`) is absent, matching the legacy
 * read precedence `options.advanced ?? widget.advanced`. Writing `undefined`
 * clears the runtime advanced flag.
 */
export function applyLegacyAdvancedWrite(
  visibility: WidgetVisibilityComponent,
  advanced: boolean | undefined,
  hasRegistrationAdvanced: boolean
): void {
  const surfaces: readonly WidgetSurface[] = hasRegistrationAdvanced
    ? ['canvas']
    : WIDGET_SURFACES
  setWidgetAdvanced(visibility, advanced === true, surfaces)
}
