export function isMenuDismissalClick(
  event: Event,
  shownFrom: EventTarget | null,
  dismissingPress: Node | null
) {
  const control = event.currentTarget
  return (
    event instanceof MouseEvent &&
    event.detail > 0 &&
    control instanceof Node &&
    control === shownFrom &&
    dismissingPress !== null &&
    control.contains(dismissingPress)
  )
}

export function getMenuAnchorPosition(event: Event) {
  if (
    event instanceof MouseEvent &&
    !(event.type === 'click' && event.detail === 0)
  ) {
    return { x: event.clientX, y: event.clientY }
  }
  const target = event.currentTarget ?? event.target
  const rect = target instanceof Element ? target.getBoundingClientRect() : null

  return {
    x: rect?.left ?? 0,
    y: rect?.top ?? 0
  }
}
