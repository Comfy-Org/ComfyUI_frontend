interface FractionRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** Where a pointer is over `frame`, as fractions of its width and height. */
export function pointerFraction(
  event: PointerEvent,
  frame: HTMLElement | null | undefined
): { x: number; y: number } {
  const box = frame?.getBoundingClientRect()
  if (!box?.width || !box.height) return { x: 0, y: 0 }
  return {
    x: (event.clientX - box.left) / box.width,
    y: (event.clientY - box.top) / box.height
  }
}

/** Absolute placement for a box given in fractions of its frame. */
export function rectStyle(rect: FractionRect) {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.w * 100}%`,
    height: `${rect.h * 100}%`
  }
}
