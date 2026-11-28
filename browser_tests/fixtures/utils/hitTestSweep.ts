import type { Locator } from '@playwright/test'

/** Offsets along each element's horizontal centre line where another element receives the pointer. */
export function findCoveredButtonPoints(buttons: Locator) {
  return buttons.evaluateAll((elements) =>
    elements.flatMap((button) => {
      const box = button.getBoundingClientRect()
      const y = box.top + box.height / 2
      const covered: string[] = []
      for (let dx = 0.5; dx < box.width; dx += 1) {
        const hit = document.elementFromPoint(box.left + dx, y)
        if (!hit || button.contains(hit)) continue
        const owner = hit.closest('[data-part], [data-testid]') ?? hit
        const name =
          owner.getAttribute('data-part') ??
          owner.getAttribute('data-testid') ??
          owner.tagName
        covered.push(`${Math.floor(dx)}px by ${name}`)
      }
      if (!covered.length) return []
      const row = button.closest('[data-widget-name]')
      return [
        {
          button: `${row?.getAttribute('data-widget-name')} ${button.getAttribute('aria-label') ?? button.textContent.trim()}`,
          coveredPoints: covered.length,
          firstCovered: covered.slice(0, 3)
        }
      ]
    })
  )
}
