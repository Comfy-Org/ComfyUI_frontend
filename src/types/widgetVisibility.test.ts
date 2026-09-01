import { describe, expect, it } from 'vitest'

import {
  applyLegacyHiddenWrite,
  deriveWidgetDisplay,
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

describe('deriveWidgetDisplay', () => {
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
  ] as const)('applies display policy for %o', ([widget, expected]) => {
    const display = deriveWidgetDisplay(widget)
    expect(WIDGET_SURFACES.map((surface) => display[surface])).toEqual(expected)
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
        visibility.display[surface] = tier
        expect(
          isWidgetVisibleOnSurface(visibility, surface, { showAdvanced })
        ).toBe(expected)
      }
    }
  )

  it('suppression hides on every surface regardless of tier', () => {
    const suppressed = {
      display: { ...shown.display },
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

  it('hidden writes round-trip without losing static display tiers', () => {
    const visibility = deriveWidgetVisibility({
      type: 'number',
      advanced: true
    })
    applyLegacyHiddenWrite(visibility, true)
    expect(isWidgetHidden(visibility)).toBe(true)
    applyLegacyHiddenWrite(visibility, false)
    expect(isWidgetHidden(visibility)).toBe(false)
    expect(visibility.display.canvas).toBe('advanced')
  })

  it('hideInPanel writes toggle the panel tier around its vueNode baseline', () => {
    const advanced = deriveWidgetVisibility({
      type: 'number',
      options: { advanced: true }
    })
    setWidgetHiddenInPanel(advanced, true)
    expect(isWidgetHiddenInPanel(advanced)).toBe(true)
    setWidgetHiddenInPanel(advanced, false)
    expect(advanced.display.panel).toBe('advanced')

    const canvasOnly = deriveWidgetVisibility({
      type: 'combo',
      options: { canvasOnly: true }
    })
    setWidgetHiddenInPanel(canvasOnly, false)
    expect(canvasOnly.display.panel).toBe('never')
  })

  it('advanced writes toggle shown tiers only', () => {
    const visibility = deriveWidgetVisibility({
      type: 'number',
      options: { hideInPanel: true }
    })
    setWidgetAdvanced(visibility, true)
    expect(isWidgetAdvanced(visibility)).toBe(true)
    expect(visibility.display).toEqual({
      canvas: 'advanced',
      vueNode: 'advanced',
      panel: 'never'
    })
    setWidgetAdvanced(visibility, false)
    expect(isWidgetAdvanced(visibility)).toBe(false)
    expect(visibility.display.panel).toBe('never')
  })
})
