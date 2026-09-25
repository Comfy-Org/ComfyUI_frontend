export type MenuAnchorOptions = {
  target: 'current' | 'current-or-event'
  verticalEdge: 'top' | 'bottom'
}

export function getMenuAnchor(event: Event, options: MenuAnchorOptions) {
  const mouseEvent = event instanceof MouseEvent ? event : undefined
  const target =
    options.target === 'current'
      ? event.currentTarget
      : (event.currentTarget ?? event.target)
  const rect = target instanceof Element ? target.getBoundingClientRect() : null

  return {
    x: mouseEvent?.clientX ?? rect?.left ?? 0,
    y:
      mouseEvent?.clientY ??
      (options.verticalEdge === 'bottom' ? rect?.bottom : rect?.top) ??
      0
  }
}
