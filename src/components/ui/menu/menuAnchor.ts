export function getMenuAnchor(event: Event) {
  if (event instanceof MouseEvent) {
    return { x: event.clientX, y: event.clientY }
  }
  const target = event.currentTarget ?? event.target
  const rect = target instanceof Element ? target.getBoundingClientRect() : null

  return {
    x: rect?.left ?? 0,
    y: rect?.top ?? 0
  }
}
