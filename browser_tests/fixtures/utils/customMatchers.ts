import type { ExpectMatcherState, Locator } from '@playwright/test'
import { expect } from '@playwright/test'

import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'
import type { Position, Size } from '@e2e/fixtures/types'

type Bounds = Position & Size

function makeMatcher<T>(
  getValue: (node: NodeReference) => Promise<T> | T,
  type: string
) {
  return async function (
    this: ExpectMatcherState,
    node: NodeReference,
    options?: { timeout?: number; intervals?: number[] }
  ) {
    await expect(async () => {
      const value = await getValue(node)
      if (this.isNot) {
        expect(value, 'Node is ' + type).not.toBeTruthy()
      } else {
        expect(value, 'Node is not ' + type).toBeTruthy()
      }
    }).toPass({ timeout: 5000, ...options })
    return {
      pass: !this.isNot,
      message: () => 'Node is ' + (this.isNot ? 'not ' : '') + type
    }
  }
}

export const comfyExpect = expect.extend({
  toBePinned: makeMatcher((n) => n.isPinned(), 'pinned'),
  toBeBypassed: makeMatcher((n) => n.isBypassed(), 'bypassed'),
  toBeCollapsed: makeMatcher((n) => n.isCollapsed(), 'collapsed'),
  async toHaveFocus(locator: Locator, options = {}) {
    await expect
      .poll(
        () => locator.evaluate((el) => el === document.activeElement),
        options
      )
      .toBe(!this.isNot)

    const isFocused = await locator.evaluate(
      (el) => el === document.activeElement
    )
    return {
      pass: isFocused,
      message: () => `Expected element to ${isFocused ? 'not ' : ''}be focused.`
    }
  },
  async toHaveBounds(
    locator: Locator,
    expected: Bounds,
    { numDigits }: { numDigits?: number } = {}
  ) {
    const message = (box: object) =>
      `Bounds ${JSON.stringify(box)} should ${this.isNot ? 'not ' : ''}match ${JSON.stringify(expected)}`

    const assertBounds = async () => {
      const box = await locator.boundingBox()
      if (!box) throw new Error(`Failed to resolve bounds for ${locator}`)

      const assertBoundsEqual = () => {
        for (const key of ['x', 'y', 'width', 'height'] as const)
          expect(box[key], key).toBeCloseTo(expected[key], numDigits)
      }
      if (this.isNot) expect(assertBoundsEqual, message(box)).toThrow()
      else expect(assertBoundsEqual, message(box)).not.toThrow()
    }

    await expect(assertBounds).toPass({ timeout: 5000 })
    const box = await locator.boundingBox
    return { pass: !this.isNot, message: () => message(box) }
  }
})
