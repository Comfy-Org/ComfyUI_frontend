import { exceedsClickThreshold } from '@/composables/useClickDragGuard'

type ContextMenuGuardOptions = {
  isDisabled?: () => boolean
  dragThreshold?: number
}

export function attachContextMenuGuard(
  target: HTMLElement,
  onMenu: (event: MouseEvent) => void,
  { isDisabled = () => false, dragThreshold = 5 }: ContextMenuGuardOptions = {}
): () => void {
  const abort = new AbortController()
  const { signal } = abort

  let start = { x: 0, y: 0 }
  let moved = false

  target.addEventListener(
    'mousedown',
    (e) => {
      if (e.button === 2) {
        start = { x: e.clientX, y: e.clientY }
        moved = false
      }
    },
    { signal }
  )

  target.addEventListener(
    'mousemove',
    (e) => {
      if (
        e.buttons === 2 &&
        exceedsClickThreshold(
          start,
          { x: e.clientX, y: e.clientY },
          dragThreshold
        )
      ) {
        moved = true
      }
    },
    { signal }
  )

  target.addEventListener(
    'contextmenu',
    (e) => {
      if (isDisabled()) return

      const wasDragging =
        moved ||
        exceedsClickThreshold(
          start,
          { x: e.clientX, y: e.clientY },
          dragThreshold
        )

      moved = false

      if (wasDragging) return

      e.preventDefault()
      e.stopPropagation()
      onMenu(e)
    },
    { signal }
  )

  return () => abort.abort()
}
