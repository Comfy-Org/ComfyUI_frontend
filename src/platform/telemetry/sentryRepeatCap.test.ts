import type { ErrorEvent } from '@sentry/vue'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  MAX_SENTRY_EVENTS_PER_SIGNATURE,
  capRepeatedSentryEvent,
  resetSentryRepeatCapForTests
} from './sentryRepeatCap'

function errorEvent(
  value: string,
  extra: Partial<ErrorEvent> = {}
): ErrorEvent {
  return {
    type: undefined,
    exception: { values: [{ type: 'Error', value }] },
    ...extra
  }
}

function sendTimes(times: number, make: () => ErrorEvent): number {
  let sent = 0
  for (let i = 0; i < times; i++) {
    if (capRepeatedSentryEvent(make())) sent++
  }
  return sent
}

describe('capRepeatedSentryEvent', () => {
  beforeEach(() => resetSentryRepeatCapForTests())

  it('sends the first repeats of an error and drops the rest of the storm', () => {
    expect(
      sendTimes(50, () => errorEvent('Graph serialization state mismatch'))
    ).toBe(MAX_SENTRY_EVENTS_PER_SIGNATURE)
  })

  it('caps an error even when other errors interleave with it', () => {
    let sent = 0
    for (let i = 0; i < 10; i++) {
      if (capRepeatedSentryEvent(errorEvent('repeating'))) sent++
      capRepeatedSentryEvent(errorEvent(`unique ${i}`))
    }

    expect(sent).toBe(MAX_SENTRY_EVENTS_PER_SIGNATURE)
  })

  it('counts each distinct error on its own budget', () => {
    sendTimes(10, () => errorEvent('first'))

    expect(capRepeatedSentryEvent(errorEvent('second'))).not.toBeNull()
  })

  it('separates the same message reported under different error types', () => {
    sendTimes(10, () =>
      errorEvent('Failed to fetch', { tags: { error_type: 'a' } })
    )

    expect(
      capRepeatedSentryEvent(
        errorEvent('Failed to fetch', { tags: { error_type: 'b' } })
      )
    ).not.toBeNull()
  })

  it('groups by an explicit fingerprint over the message', () => {
    const fingerprint = ['WorkspaceApiError', 'listWorkspaces', '503', 'none']
    sendTimes(10, () => errorEvent('one', { fingerprint }))

    expect(
      capRepeatedSentryEvent(errorEvent('two', { fingerprint }))
    ).toBeNull()
  })

  it('caps message-only events by their message', () => {
    expect(
      sendTimes(10, () => ({ type: undefined, message: 'assert failed' }))
    ).toBe(MAX_SENTRY_EVENTS_PER_SIGNATURE)
  })

  it('keeps an event it cannot identify', () => {
    expect(sendTimes(10, () => ({ type: undefined }))).toBe(10)
  })

  it('separates empty-exception events by their message instead of sharing one budget', () => {
    sendTimes(10, () => ({
      type: undefined,
      exception: { values: [{}] },
      message: 'first'
    }))

    expect(
      capRepeatedSentryEvent({
        type: undefined,
        exception: { values: [{}] },
        message: 'second'
      })
    ).not.toBeNull()
  })

  it('keeps an empty-exception event with no message, same as an unidentifiable one', () => {
    expect(
      sendTimes(10, () => ({ type: undefined, exception: { values: [{}] } }))
    ).toBe(10)
  })
})
