import { describe, expect, it } from 'vitest'

import {
  applyLegacyAdvancedWrite,
  applyLegacyHiddenWrite,
  deriveWidgetSurfaces,
  deriveWidgetVisibility,
  isLegacyHiddenWidgetType,
  isLegacyWidgetHidingType,
  isWidgetAdvanced,
  isWidgetHidden,
  isWidgetHiddenInPanel,
  isWidgetVisibleOnSurface,
  occupiesCanvasRow,
  setWidgetAdvanced,
  setWidgetHiddenInPanel,
  WIDGET_SURFACES
} from '@/types/widgetVisibility'

describe('deriveWidgetSurfaces', () => {
  it.for([
    [{ type: 'number' }, ['shown', 'shown', 'shown']],
    [
      { type: 'number', options: { advanced: true } },
      ['shown', 'advanced', 'advanced']
    ],
    [{ type: 'number', advanced: true }, ['advanced', 'advanced', 'advanced']],
    [
      { type: 'combo', options: { canvasOnly: true } },
      ['shown', 'never', 'never']
    ],
    [
      { type: 'text', options: { hideInPanel: true } },
      ['shown', 'shown', 'never']
    ]
  ] as const)('applies surface policy for %o', ([widget, expected]) => {
    const surfaces = deriveWidgetSurfaces(widget)
    expect(WIDGET_SURFACES.map((surface) => surfaces[surface])).toEqual(
      expected
    )
  })
})

describe('isWidgetVisibleOnSurface', () => {
  const shown = deriveWidgetVisibility({ type: 'number' })

  it.for([
    ['shown', false, true],
    ['advanced', false, false],
    ['advanced', true, true],
    ['never', true, false]
  ] as const)(
    '%s with showAdvanced %s resolves to %s on every surface',
    ([tier, showAdvanced, expected]) => {
      const visibility = deriveWidgetVisibility({ type: 'number' })
      for (const surface of WIDGET_SURFACES) {
        visibility.surfaces[surface] = tier
        expect(
          isWidgetVisibleOnSurface(visibility, surface, { showAdvanced })
        ).toBe(expected)
      }
    }
  )

  it('suppression hides on every surface regardless of tier', () => {
    const suppressed = {
      surfaces: { ...shown.surfaces },
      suppression: { byExtension: false, byConnection: true }
    }
    expect(
      isWidgetVisibleOnSurface(suppressed, 'canvas', { showAdvanced: true })
    ).toBe(false)
    expect(
      isWidgetVisibleOnSurface(suppressed, 'vueNode', { showAdvanced: true })
    ).toBe(false)
    expect(
      isWidgetVisibleOnSurface(suppressed, 'panel', { showAdvanced: true })
    ).toBe(false)
  })

  it('advanced tier is gated by the view', () => {
    const advanced = deriveWidgetVisibility({
      type: 'number',
      advanced: true
    })
    expect(
      isWidgetVisibleOnSurface(advanced, 'canvas', { showAdvanced: false })
    ).toBe(false)
    expect(
      isWidgetVisibleOnSurface(advanced, 'canvas', { showAdvanced: true })
    ).toBe(true)
  })
})

describe('occupiesCanvasRow', () => {
  it('keeps the row for a connection-suppressed widget', () => {
    const visibility = deriveWidgetVisibility({ type: 'number' })
    visibility.suppression.byConnection = true
    expect(occupiesCanvasRow(visibility, { showAdvanced: false })).toBe(true)
    expect(
      isWidgetVisibleOnSurface(visibility, 'canvas', { showAdvanced: false })
    ).toBe(false)
  })

  it('keeps the row for a connection-suppressed advanced widget regardless of the toggle', () => {
    const visibility = deriveWidgetVisibility({
      type: 'number',
      advanced: true
    })
    visibility.suppression.byConnection = true
    expect(occupiesCanvasRow(visibility, { showAdvanced: false })).toBe(true)
  })

  it('drops the row for extension-hidden widgets', () => {
    const visibility = deriveWidgetVisibility({ type: 'number', hidden: true })
    visibility.suppression.byConnection = true
    expect(occupiesCanvasRow(visibility, { showAdvanced: true })).toBe(false)
  })

  it('follows the canvas tier when not suppressed', () => {
    const visibility = deriveWidgetVisibility({
      type: 'number',
      advanced: true
    })
    expect(occupiesCanvasRow(visibility, { showAdvanced: false })).toBe(false)
    expect(occupiesCanvasRow(visibility, { showAdvanced: true })).toBe(true)
  })
})

describe('legacy facades', () => {
  it.for([
    ['options.hidden', { type: 'number', options: { hidden: true } }],
    ['widget.hidden', { type: 'number', hidden: true }],
    ['type "hidden"', { type: 'hidden' }],
    ['tschide type', { type: 'tschideSeed' }]
  ] as const)('registration hidden via %s starts suppressed', ([, source]) => {
    const visibility = deriveWidgetVisibility(source)
    expect(visibility.suppression.byExtension).toBe(true)
    expect(isWidgetHidden(visibility)).toBe(true)
  })

  it('tolerates nullish widget types written by extensions', () => {
    expect(isLegacyHiddenWidgetType(null)).toBe(false)
    expect(isLegacyHiddenWidgetType(undefined)).toBe(false)
    expect(isLegacyWidgetHidingType(null)).toBe(false)
    expect(isLegacyWidgetHidingType(undefined)).toBe(false)
  })

  it('canvasOnly plus hideInPanel does not read as hidden', () => {
    const canvasOnly = deriveWidgetVisibility({
      type: 'combo',
      options: { canvasOnly: true, hideInPanel: true }
    })
    expect(isWidgetHidden(canvasOnly)).toBe(false)
  })

  it('hidden writes round-trip without losing static surface tiers', () => {
    const visibility = deriveWidgetVisibility({
      type: 'number',
      advanced: true
    })
    applyLegacyHiddenWrite(visibility, true)
    expect(isWidgetHidden(visibility)).toBe(true)
    applyLegacyHiddenWrite(visibility, false)
    expect(isWidgetHidden(visibility)).toBe(false)
    expect(visibility.surfaces.canvas).toBe('advanced')
  })

  it('hideInPanel writes toggle the panel tier around its vueNode baseline', () => {
    const advanced = deriveWidgetVisibility({
      type: 'number',
      options: { advanced: true }
    })
    setWidgetHiddenInPanel(advanced, true)
    expect(isWidgetHiddenInPanel(advanced)).toBe(true)
    setWidgetHiddenInPanel(advanced, false)
    expect(advanced.surfaces.panel).toBe('advanced')

    const canvasOnly = deriveWidgetVisibility({
      type: 'combo',
      options: { canvasOnly: true }
    })
    setWidgetHiddenInPanel(canvasOnly, false)
    expect(canvasOnly.surfaces.panel).toBe('never')
  })

  it('advanced writes toggle shown tiers only', () => {
    const visibility = deriveWidgetVisibility({
      type: 'number',
      options: { hideInPanel: true }
    })
    setWidgetAdvanced(visibility, true)
    expect(isWidgetAdvanced(visibility)).toBe(true)
    expect(visibility.surfaces).toEqual({
      canvas: 'advanced',
      vueNode: 'advanced',
      panel: 'never'
    })
    setWidgetAdvanced(visibility, false)
    expect(isWidgetAdvanced(visibility)).toBe(false)
    expect(visibility.surfaces.panel).toBe('never')
  })

  it('runtime advanced writes gate all surfaces without registration advanced', () => {
    const visibility = deriveWidgetVisibility({ type: 'number' })
    applyLegacyAdvancedWrite(visibility, true, false)
    expect(visibility.surfaces).toEqual({
      canvas: 'advanced',
      vueNode: 'advanced',
      panel: 'advanced'
    })
    applyLegacyAdvancedWrite(visibility, undefined, false)
    expect(visibility.surfaces).toEqual({
      canvas: 'shown',
      vueNode: 'shown',
      panel: 'shown'
    })
  })

  it('runtime advanced writes gate only the canvas when registration advanced exists', () => {
    const visibility = deriveWidgetVisibility({
      type: 'number',
      options: { advanced: true }
    })
    applyLegacyAdvancedWrite(visibility, true, true)
    expect(visibility.surfaces.canvas).toBe('advanced')
    applyLegacyAdvancedWrite(visibility, undefined, true)
    expect(visibility.surfaces).toEqual({
      canvas: 'shown',
      vueNode: 'advanced',
      panel: 'advanced'
    })
  })
})
