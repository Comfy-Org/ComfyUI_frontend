import { describe, expect, it } from 'vitest'

import type { SocketClose } from './socketReconnectDelay'
import {
  sessionRecoveryDelayMs,
  socketReconnectDelayMs
} from './socketReconnectDelay'

describe('socketReconnectDelayMs', () => {
  it.for<{ name: string; close: SocketClose; windowMs: number }>([
    { name: 'an opened socket', close: { opened: true }, windowMs: 5_000 },
    {
      name: 'an opened socket closed for a service restart',
      close: { opened: true, code: 1012 },
      windowMs: 15_000
    },
    {
      name: 'the first failed attempt',
      close: { opened: false, failedAttempts: 0 },
      windowMs: 1_000
    },
    {
      name: 'the third failed attempt',
      close: { opened: false, failedAttempts: 2 },
      windowMs: 4_000
    },
    {
      name: 'a long run of failed attempts',
      close: { opened: false, failedAttempts: 40 },
      windowMs: 30_000
    }
  ])(
    'draws uniformly from [0, $windowMs] after $name',
    ({ close, windowMs }) => {
      expect(socketReconnectDelayMs(close, () => 0)).toBe(0)
      expect(socketReconnectDelayMs(close, () => 0.5)).toBe(windowMs / 2)
      expect(socketReconnectDelayMs(close, () => 1)).toBe(windowMs)
    }
  )
})

describe('sessionRecoveryDelayMs', () => {
  it('doubles from 1s and settles at one attempt per minute', () => {
    expect([0, 1, 5, 6, 20].map(sessionRecoveryDelayMs)).toEqual([
      1_000, 2_000, 32_000, 60_000, 60_000
    ])
  })
})
