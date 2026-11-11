/** Where an element belongs: inside `parent`, before `before` or at its end. */
export interface DockPlace {
  parent: Element
  before: Element | null
}

/**
 * The place directly after the `marker` inside `parent`, skipping `own` when it
 * already sits there; the end of `parent` when there is no marker.
 */
export function placeAfterMarker(
  own: Element,
  parent: string,
  marker: string
): DockPlace | null {
  const container = document.querySelector(parent)
  if (!container) return null
  const next = container.querySelector(marker)?.nextElementSibling ?? null
  return {
    parent: container,
    before: next === own ? own.nextElementSibling : next
  }
}

/**
 * Puts `slot` where `findPlace` says and puts it back whenever the page
 * moves or drops it. `onChange` hears whether there is a place at all.
 */
export function keepDocked(
  slot: Element,
  findPlace: () => DockPlace | null,
  onChange: (docked: boolean) => void
): () => void {
  let frame = 0
  let docked: boolean | null = null

  function settle(): void {
    frame = 0
    const place = findPlace()
    const isInPlace =
      place !== null &&
      slot.parentElement === place.parent &&
      slot.nextElementSibling === place.before
    if (place && !isInPlace) place.parent.insertBefore(slot, place.before)
    if (!place) slot.remove()
    if (docked === (place !== null)) return
    docked = place !== null
    onChange(docked)
  }

  const observer = new MutationObserver(() => {
    frame ||= requestAnimationFrame(settle)
  })
  observer.observe(document.body, { childList: true, subtree: true })
  settle()

  return () => {
    observer.disconnect()
    cancelAnimationFrame(frame)
    slot.remove()
  }
}
