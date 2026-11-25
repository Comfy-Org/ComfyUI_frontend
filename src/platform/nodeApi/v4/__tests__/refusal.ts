import { assert, expect } from 'vitest'

import { isInvalidArgument } from '@/platform/nodeApi/shared/invalidArgument'

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
