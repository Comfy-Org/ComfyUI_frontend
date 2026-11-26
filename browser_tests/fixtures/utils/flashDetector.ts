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
    hasFlashed: () => hasElementFlashed(page, testId)
  }
}

export async function hasElementFlashed(
  page: Page,
  testId: string
): Promise<boolean> {
  return (
    (await page.locator('html').getAttribute(flagAttributeFor(testId))) ===
    'true'
  )
}

/** Like {@link trackElementFlash}, for a `role="dialog"` matched by its accessible name. */
export async function trackDialogFlash(
  page: Page,
  name: string
): Promise<{ hasFlashed: () => Promise<boolean> }> {
  const flagAttribute = flagAttributeFor(`dialog:${name}`)
  const reportBinding = flagAttribute.replaceAll('-', '_')
  let flashedInEarlierDocument = false
  await page.exposeFunction(reportBinding, () => {
    flashedInEarlierDocument = true
  })

  await page.addInitScript(
    ({
      dialogName,
      attribute,
      binding
    }: {
      dialogName: string
      attribute: string
      binding: string
    }) => {
      const accessibleName = (el: Element) =>
        el.getAttribute('aria-label')?.trim() ||
        (el.getAttribute('aria-labelledby') ?? '')
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim()
      const report = Reflect.get(window, binding)
      const sample = () => {
        for (const el of document.querySelectorAll('[role="dialog"]')) {
          if (
            accessibleName(el) === dialogName &&
            el.checkVisibility({
              checkOpacity: true,
              checkVisibilityCSS: true
            }) &&
            !document.documentElement.hasAttribute(attribute)
          ) {
            document.documentElement.setAttribute(attribute, 'true')
            if (typeof report === 'function') void report()
          }
        }
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    },
    { dialogName: name, attribute: flagAttribute, binding: reportBinding }
  )

  return {
    hasFlashed: async () => {
      if (flashedInEarlierDocument) return true
      const flaggedInCurrentDocument =
        (await page.locator('html').getAttribute(flagAttribute)) === 'true'
      return flaggedInCurrentDocument || flashedInEarlierDocument
    }
  }
}
