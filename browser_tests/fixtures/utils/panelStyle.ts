import type { Locator } from '@playwright/test'

export function readPanelStyle(locator: Locator) {
  return locator.evaluate((el) => {
    const style = getComputedStyle(el)
    return {
      backgroundColor: style.backgroundColor,
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      padding: style.padding,
      borderStyle: style.borderStyle
    }
  })
}
