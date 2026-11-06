import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

export function cancelLinkDragOnWindowBlur(canvas: LGraphCanvas): () => void {
  const cancelLinkDrag = () => {
    if (canvas.pointer.isDown && canvas.linkConnector.isConnecting) {
      canvas.pointer.reset()
    }
  }
  window.addEventListener('blur', cancelLinkDrag)
  return () => window.removeEventListener('blur', cancelLinkDrag)
}
