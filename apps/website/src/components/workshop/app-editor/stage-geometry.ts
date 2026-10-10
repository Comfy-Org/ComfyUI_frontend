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

/**
 * The stage's fitted box inside a `container-type: size` parent: as wide
 * as fits, at the image's aspect ratio.
 */
export function fittedSize(width: number, height: number) {
  return {
    width: `min(100cqw, calc(100cqh * ${width || 3} / ${height || 2}))`,
    aspectRatio: `${width || 3} / ${height || 2}`
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
