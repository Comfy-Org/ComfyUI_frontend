export function fullSelectionCanvas(
  docW: number,
  docH: number
): HTMLCanvasElement | null {
  const c = document.createElement('canvas')
  c.width = docW
  c.height = docH
  const g = c.getContext('2d')
  if (!g) return null
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, docW, docH)
  return c
}
