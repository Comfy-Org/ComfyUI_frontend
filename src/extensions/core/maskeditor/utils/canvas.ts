export const getCanvas2dContext = (
  canvas: HTMLCanvasElement
): CanvasRenderingContext2D => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  // Safe with the way we use canvases
  if (!ctx) throw new Error('Failed to get 2D context from canvas')
  return ctx
}

export const createCanvasCopy = (
  canvas: HTMLCanvasElement
): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const newCanvas = document.createElement('canvas')
  const newCanvasCtx = getCanvas2dContext(newCanvas)
  newCanvas.width = canvas.width
  newCanvas.height = canvas.height
  newCanvasCtx.clearRect(0, 0, canvas.width, canvas.height)
  newCanvasCtx.drawImage(
    canvas,
    0,
    0,
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height
  )
  return [newCanvas, newCanvasCtx]
}

export const combineOriginalImageAndPaint = (
  canvases: Record<'originalImage' | 'paint', HTMLCanvasElement>
): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const { originalImage, paint } = canvases
  const [resultCanvas, resultCanvasCtx] = createCanvasCopy(originalImage)
  resultCanvasCtx.drawImage(paint, 0, 0)
  return [resultCanvas, resultCanvasCtx]
}
