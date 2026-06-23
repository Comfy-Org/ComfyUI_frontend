import { afterEach, describe, expect, it } from 'vitest'

import {
  coachmarkElements,
  registerCoachmark,
  unregisterCoachmark
} from './coachmarkRegistry'

describe('coachmarkRegistry', () => {
  const a = document.createElement('div')
  const b = document.createElement('div')

  afterEach(() => {
    unregisterCoachmark('run-button', a)
    unregisterCoachmark('run-button', b)
  })

  it('resolves every element registered for an id', () => {
    registerCoachmark('run-button', a)
    registerCoachmark('run-button', b)
    expect(coachmarkElements('run-button')).toEqual([a, b])
  })

  it('keeps the remaining elements when one of several unregisters', () => {
    registerCoachmark('run-button', a)
    registerCoachmark('run-button', b)
    unregisterCoachmark('run-button', a)
    expect(coachmarkElements('run-button')).toEqual([b])
  })

  it('clears the id once its last element unregisters', () => {
    registerCoachmark('run-button', a)
    unregisterCoachmark('run-button', a)
    expect(coachmarkElements('run-button')).toEqual([])
  })
})
