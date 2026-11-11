import { describe, expect, it } from 'vitest'

import { resolveSwitch } from './activation'

describe('resolveSwitch', () => {
  it('is off by default', () => {
    expect(resolveSwitch('layer', '', localStorage)).toBe(false)
    expect(resolveSwitch('layer', '?other=1', localStorage)).toBe(false)
  })

  it('turns on from the URL and stays on without it', () => {
    expect(resolveSwitch('layer', '?pointAtIt=on', localStorage)).toBe(true)
    expect(resolveSwitch('layer', '', localStorage)).toBe(true)
  })

  it('turns off from the URL and stays off', () => {
    resolveSwitch('layer', '?pointAtIt=on', localStorage)

    expect(resolveSwitch('layer', '?pointAtIt=off', localStorage)).toBe(false)
    expect(resolveSwitch('layer', '', localStorage)).toBe(false)
  })

  it('H-01, H-02: keeps the stroke entry off until its own switch is used', () => {
    expect(resolveSwitch('stroke', '?pointAtIt=on', localStorage)).toBe(false)
    expect(
      resolveSwitch('stroke', '?pointAtIt=on&pointAtItStroke=on', localStorage)
    ).toBe(true)
    expect(resolveSwitch('stroke', '', localStorage)).toBe(true)
    expect(resolveSwitch('stroke', '?pointAtItStroke=off', localStorage)).toBe(
      false
    )
  })
})
