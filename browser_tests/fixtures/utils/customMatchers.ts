import type { ExpectMatcherState, Locator } from '@playwright/test'
import { expect } from '@playwright/test'

import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'

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
      const assertion = this.isNot
        ? expect(value, 'Node is ' + type).not
        : expect(value, 'Node is not ' + type)
      assertion.toBeTruthy()
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
  }
})
