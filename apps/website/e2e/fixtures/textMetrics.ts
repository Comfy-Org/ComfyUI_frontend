import type { Locator } from '@playwright/test'

export async function textWidth(locator: Locator) {
  return locator.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    return range.getBoundingClientRect().width
  })
}

export async function waitForAnimations(locator: Locator) {
  await locator.evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined))
    )
  })
}
