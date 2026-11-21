import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'

async function top(locator: Locator): Promise<number> {
  const box = await locator.boundingBox()
  return box?.y ?? Number.NaN
}

/** Polls until the locators' top edges run strictly top to bottom, in order. */
export async function expectTopToBottom(...locators: Locator[]): Promise<void> {
  await expect
    .poll(async () => {
      const tops = await Promise.all(locators.map(top))
      return tops.every((y, index) => index === 0 || tops[index - 1] < y)
    })
    .toBe(true)
}
