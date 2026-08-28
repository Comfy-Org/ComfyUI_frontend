import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

import { visibleCanvasViewport } from './visibleCanvasViewport'

describe('visibleCanvasViewport', () => {
  beforeEach(() => {
    vi.stubGlobal('devicePixelRatio', 2)
  })

  it('spans the full CSS-pixel canvas', () => {
    const canvas = {
      canvas: { width: 1600, height: 900 }
    } as LGraphCanvas

    expect(visibleCanvasViewport(canvas)).toEqual([0, 0, 800, 450])
  })
})
