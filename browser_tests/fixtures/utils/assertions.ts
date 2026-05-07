import type { Locator } from '@playwright/test'

/**
 * Retrieve the bounding box of a locator, throwing a descriptive error if
 * the element has no layout (hidden, detached, or zero-sized).
 */
export async function assertBoundingBox(
  locator: Locator,
  context?: string
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error(
      `${context ?? 'Element'} has no bounding box — it may be hidden, detached, or zero-sized`
    )
  }
  return box
}
