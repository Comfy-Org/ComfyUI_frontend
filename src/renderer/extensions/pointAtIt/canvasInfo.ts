import { watch } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'

/** The canvas as far as its info lines go: drawn by a method, redrawn on request. */
type InfoCanvas = Pick<LGraphCanvas, 'renderInfo' | 'setDirty'>

function drawNothing(): void {}

function stopDrawingInfo(canvas: InfoCanvas): () => void {
  canvas.renderInfo = drawNothing
  canvas.setDirty(true, true)
  return () => {
    Reflect.deleteProperty(canvas, 'renderInfo')
    canvas.setDirty(true, true)
  }
}

/**
 * Stops the canvas drawing its info lines (the fps and the rest, at the bottom
 * left) and returns what brings them back. Temporary, for the companion's
 * corner. It puts a method that draws nothing on the canvas object in front of
 * the real one and takes it away again, so the app's Canvas Info setting, which
 * is saved, is neither read nor written. The app makes its canvas a moment
 * after the layer starts, so `canvas` is read again whenever it changes.
 */
export function hideCanvasInfoOf(canvas: () => InfoCanvas | null): () => void {
  let showAgain = drawNothing
  const stop = watch(
    canvas,
    (current) => {
      showAgain()
      showAgain = current ? stopDrawingInfo(current) : drawNothing
    },
    { immediate: true, flush: 'sync' }
  )
  return () => {
    stop()
    showAgain()
    showAgain = drawNothing
  }
}
