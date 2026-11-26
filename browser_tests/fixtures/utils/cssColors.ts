import type { Locator, Page } from '@playwright/test'

export function readBackgroundColor(locator: Locator) {
  return locator.evaluate((el) => getComputedStyle(el).backgroundColor)
}

export function resolveColorVariable(page: Page, variableName: string) {
  return page.evaluate((name) => {
    const probe = document.createElement('div')
    probe.style.backgroundColor = `var(${name})`
    document.body.append(probe)
    const color = getComputedStyle(probe).backgroundColor
    probe.remove()
    return color
  }, variableName)
}
