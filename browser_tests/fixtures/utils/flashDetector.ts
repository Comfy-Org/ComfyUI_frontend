import type { Page } from '@playwright/test'

function flagAttributeFor(testId: string) {
  const encoded = Array.from(testId, (ch) =>
    ch.charCodeAt(0).toString(16)
  ).join('')
  return `data-flashed-${encoded}`
}

/**
 * Flags the first time an element matching `[data-testid="<testId>"]` is
 * present and rendered, sampled every frame via `requestAnimationFrame` from
 * page load. Catches a dialog that mounts and unmounts within a few frames,
 * which `toBeHidden()` (final state only) cannot.
 *
 * Must be called before navigation (e.g. before `comfyPage.setup()`).
 */
export async function trackElementFlash(
  page: Page,
  testId: string
): Promise<{ hasFlashed: () => Promise<boolean> }> {
  const flagAttribute = flagAttributeFor(testId)

  await page.addInitScript(
    ({ id, attribute }: { id: string; attribute: string }) => {
      const sample = () => {
        const el = document.querySelector(`[data-testid="${CSS.escape(id)}"]`)
        if (el instanceof HTMLElement) {
          const rect = el.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) {
            document.documentElement.setAttribute(attribute, 'true')
          }
        }
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    },
    { id: testId, attribute: flagAttribute }
  )

  return {
    hasFlashed: async () =>
      (await page.locator('html').getAttribute(flagAttribute)) === 'true'
  }
}
