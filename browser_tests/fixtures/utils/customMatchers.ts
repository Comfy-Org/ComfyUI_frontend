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
  toBeCloseToArray(
    target: number[],
    expected: number[],
    options?: { numDigits?: number }
  ) {
    expect(target).toHaveLength(expected.length)
    const closeTo: (a: number, b: number) => void = this.isNot
      ? (a, b) => expect(a).not.toBeCloseTo(b, options?.numDigits)
      : (a, b) => expect(a).toBeCloseTo(b, options?.numDigits)
    target.forEach((a, i) => closeTo(a, expected[i]))
    const message = () =>
      `${JSON.stringify(target)} is ${this.isNot ? 'not ' : ''}close to ${JSON.stringify(expected)}`
    return { pass: !this.isNot, message }
  },
  async toHaveBounds(
    locator: Locator,
    expected: Bounds,
    { numDigits }: { numDigits?: number } = {}
  ) {
    await expect(async () => {
      const box = (await locator.boundingBox())!
      const closeTo: (k: keyof Bounds) => void = this.isNot
        ? (k) => expect(box[k], k).not.toBeCloseTo(expected[k], numDigits)
        : (k) => expect(box[k], k).toBeCloseTo(expected[k], numDigits)
      for (const key of ['x', 'y', 'width', 'height'] as const) closeTo(key)
    }).toPass({ timeout: 5000 })

    const box = (await locator.boundingBox())!
    const message = () =>
      `Bounds ${box} ${this.isNot ? 'does not match' : 'matches'} ${JSON.stringify(expected)}`
    return { pass: !this.isNot, message }
  }
})
