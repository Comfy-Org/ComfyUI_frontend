import { onTestFinished, vi } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import type { app as realApp } from '@/scripts/app'

type Canvas = Pick<typeof realApp.canvas, 'graph' | 'setDirty'>

const setDirty = vi.fn<Canvas['setDirty']>()
let canvas: Canvas | undefined

export const app = {
  get canvas(): Canvas {
    if (!canvas) {
      onTestFinished(() => {
        canvas = undefined
      })
      canvas = { graph: new LGraph(), setDirty }
    }
    return canvas
  }
}
