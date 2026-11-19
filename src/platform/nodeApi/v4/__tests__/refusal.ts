import { assert, expect } from 'vitest'

import { isInvalidArgument } from '@/platform/nodeApi/shared/invalidArgument'

/** Asserts that `call` throws the API's own refusal and that it names `member`. */
export function expectRefusal(call: () => unknown, member: string): void {
  let thrown: unknown
  try {
    call()
  } catch (error) {
    thrown = error
  }
  assert(thrown instanceof TypeError, `not a TypeError: ${String(thrown)}`)
  expect(isInvalidArgument(thrown)).toBe(true)
  expect(thrown.message.startsWith(`${member} needs `)).toBe(true)
}
