import { afterEach, describe, expect, it, vi } from 'vitest'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'

import { defineDeprecatedProperty, warnDeprecated } from './feedback'

let messageId = 0

/** Unique message per test; warnDeprecated deduplicates per session. */
function uniqueMessage(): string {
  messageId += 1
  return `test deprecation message ${messageId}`
}

describe('warnDeprecated', () => {
  const originalAlwaysRepeat = LiteGraph.alwaysRepeatWarnings

  afterEach(() => {
    LiteGraph.alwaysRepeatWarnings = originalAlwaysRepeat
    LiteGraph.onDeprecationWarning.length = 0
  })

  it('notifies callbacks once per unique message', () => {
    const callback = vi.fn()
    LiteGraph.onDeprecationWarning.push(callback)

    const message = uniqueMessage()
    const source = {}
    warnDeprecated(message, source)
    warnDeprecated(message, source)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(message, source)
  })

  it('repeats warnings when alwaysRepeatWarnings is enabled', () => {
    const callback = vi.fn()
    LiteGraph.onDeprecationWarning.push(callback)
    LiteGraph.alwaysRepeatWarnings = true

    const message = uniqueMessage()
    warnDeprecated(message)
    warnDeprecated(message)

    expect(callback).toHaveBeenCalledTimes(2)
  })
})

describe('defineDeprecatedProperty', () => {
  afterEach(() => {
    LiteGraph.onDeprecationWarning.length = 0
  })

  it('proxies reads and writes to the current property with a warning', () => {
    const callback = vi.fn()
    LiteGraph.onDeprecationWarning.push(callback)

    const message = uniqueMessage()
    const target: { current: number } & Record<string, unknown> = { current: 1 }
    defineDeprecatedProperty(target, 'legacy', 'current', message)

    expect(target.legacy).toBe(1)

    target.legacy = 2
    expect(target.current).toBe(2)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(message, undefined)
  })
})
