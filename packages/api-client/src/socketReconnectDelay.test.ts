import { describe, expect, it } from 'vitest'

import { socketReconnectDelayMs } from './socketReconnectDelay'

describe('socketReconnectDelayMs', () => {
  it.for([
    { random: 0, delayMs: 0 },
    { random: 0.5, delayMs: 750 },
    { random: 0.875, delayMs: 1_312.5 }
  ])(
    'spreads an opened Cloud socket reconnect to $delayMs ms when random is $random',
    ({ random, delayMs }) => {
      expect(
        socketReconnectDelayMs({ isCloud: true, opened: true }, () => random)
      ).toBe(delayMs)
    }
  )

  it.for([
    { name: 'an opened local socket', isCloud: false, opened: true },
    { name: 'a local socket that never opened', isCloud: false, opened: false },
    { name: 'a Cloud socket that never opened', isCloud: true, opened: false }
  ])('reconnects $name after a fixed 300 ms', ({ isCloud, opened }) => {
    expect(socketReconnectDelayMs({ isCloud, opened }, () => 0.5)).toBe(300)
  })
})
