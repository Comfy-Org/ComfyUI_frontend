import { afterEach, describe, expect, it } from 'vitest'

import {
  clearCoachmarks,
  coachmarkElements,
  registerCoachmark,
  targetMounted,
  waitForTarget
} from './coachmarkRegistry'
import type { CoachTarget } from './coachmarkRegistry'

function virtualTarget(rect: DOMRect): CoachTarget {
  return { getBoundingClientRect: () => rect }
}

describe('coachmarkRegistry with virtual targets', () => {
  afterEach(clearCoachmarks)

  it('registers a virtual target alongside elements', () => {
    const el = document.createElement('div')
    const virtual = virtualTarget(new DOMRect(0, 0, 80, 30))
    registerCoachmark('outputs', el)
    registerCoachmark('outputs', virtual)
    expect(coachmarkElements('outputs')).toEqual([el, virtual])
  })

  it('counts a virtual target with a sized rect as mounted', () => {
    registerCoachmark('outputs', virtualTarget(new DOMRect(5, 5, 80, 30)))
    expect(targetMounted('outputs')).toBe(true)
  })

  it('ignores a virtual target reporting a zero-sized rect', () => {
    registerCoachmark('outputs', virtualTarget(new DOMRect()))
    expect(targetMounted('outputs')).toBe(false)
  })

  it('resolves a pending wait when a sized virtual target registers', async () => {
    const signal = new AbortController().signal
    const found = waitForTarget('outputs', signal, 1000)
    registerCoachmark('outputs', virtualTarget(new DOMRect(0, 0, 80, 30)))
    await expect(found).resolves.toBe(true)
  })
})
