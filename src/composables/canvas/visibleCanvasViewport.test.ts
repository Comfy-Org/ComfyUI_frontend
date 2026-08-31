import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

import { visibleCanvasViewport } from './visibleCanvasViewport'
import { registerViewportInset } from './viewportInsetRegistry'

describe('visibleCanvasViewport', () => {
  let unregisterInset: (() => void) | undefined

  beforeEach(() => {
    vi.stubGlobal('devicePixelRatio', 2)
  })

  afterEach(() => unregisterInset?.())

  it('uses the full CSS-pixel canvas while the Agent panel is closed', () => {
    const canvas = {
      canvas: { width: 1600, height: 900 }
    } as LGraphCanvas

    expect(visibleCanvasViewport(canvas)).toEqual([0, 0, 800, 450])
  })

  it('excludes a registered feature inset from the visible canvas', () => {
    unregisterInset = registerViewportInset('test-feature', () => 500)
    const canvas = {
      canvas: { width: 1600, height: 900 }
    } as LGraphCanvas

    expect(visibleCanvasViewport(canvas)).toEqual([0, 0, 300, 450])
  })
})
