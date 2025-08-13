import { expect } from 'vitest'
import 'vue'

// Custom matchers for litegraph tests
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received)
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be one of ${expected.join(', ')}`,
        pass: true
      }
    } else {
      return {
        message: () =>
          `expected ${received} to be one of ${expected.join(', ')}`,
        pass: false
      }
    }
  }
})

// Extend the expect interface
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeOneOf(expected: T[]): T
  }
  interface AsymmetricMatchersContaining {
    toBeOneOf(expected: any[]): any
  }
}
