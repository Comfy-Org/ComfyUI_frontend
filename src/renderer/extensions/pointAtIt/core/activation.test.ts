import { describe, expect, it } from 'vitest'

import { resolveSwitch, SWITCH_STORAGE_KEY } from './activation'

describe('resolveSwitch', () => {
  it('is off by default', () => {
    expect(resolveSwitch('', localStorage)).toBe(false)
    expect(resolveSwitch('?other=1', localStorage)).toBe(false)
  })

  it('turns on from the URL and stays on without it', () => {
    expect(resolveSwitch('?pointAtIt=on', localStorage)).toBe(true)
    expect(resolveSwitch('', localStorage)).toBe(true)
    expect(localStorage.getItem(SWITCH_STORAGE_KEY)).toBe('on')
  })

  it('turns off from the URL and stays off', () => {
    resolveSwitch('?pointAtIt=on', localStorage)

    expect(resolveSwitch('?pointAtIt=off', localStorage)).toBe(false)
    expect(resolveSwitch('', localStorage)).toBe(false)
  })
})
