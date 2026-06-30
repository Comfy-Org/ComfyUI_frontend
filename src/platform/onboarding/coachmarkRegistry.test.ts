import { afterEach, describe, expect, it } from 'vitest'

import {
  clearCoachmarks,
  coachmarkElements,
  registerCoachmark,
  unregisterCoachmark
} from './coachmarkRegistry'

describe('coachmarkRegistry', () => {
  const a = document.createElement('div')
  const b = document.createElement('div')

  afterEach(clearCoachmarks)

  it('resolves every element registered for an id', () => {
    registerCoachmark('app-run-button', a)
    registerCoachmark('app-run-button', b)
    expect(coachmarkElements('app-run-button')).toEqual([a, b])
  })

  it('keeps the remaining elements when one of several unregisters', () => {
    registerCoachmark('app-run-button', a)
    registerCoachmark('app-run-button', b)
    unregisterCoachmark('app-run-button', a)
    expect(coachmarkElements('app-run-button')).toEqual([b])
  })
})
