import type { Locator } from '@playwright/test'

/** The locator's rendered height, or -1 while it has no box. */
export async function heightOf(locator: Locator): Promise<number> {
  return (await locator.boundingBox())?.height ?? -1
}

/** The locator's rendered width over height, or -1 while it has no box. */
export async function boxAspectRatio(locator: Locator): Promise<number> {
  const box = await locator.boundingBox()
  return box ? box.width / box.height : -1
}

/** The locator's bounding box; fails the test when it is not rendered. */
export async function requireBoundingBox(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Expected the locator to have a bounding box')
  return box
}
