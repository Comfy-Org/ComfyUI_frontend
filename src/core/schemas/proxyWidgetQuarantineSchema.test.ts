import { describe, expect, it } from 'vitest'

import { parseProxyWidgetErrorQuarantine } from './proxyWidgetQuarantineSchema'
import type { ProxyWidgetQuarantineReason } from './proxyWidgetQuarantineSchema'

const baseEntry = {
  originalEntry: ['10', 'seed'] as [string, string],
  reason: 'missingSourceNode' as ProxyWidgetQuarantineReason,
  attemptedAtVersion: 1 as const
}

describe(parseProxyWidgetErrorQuarantine, () => {
  it('parses a valid entry without hostValue', () => {
    expect(parseProxyWidgetErrorQuarantine([baseEntry])).toEqual([baseEntry])
  })

  it('parses a valid entry with hostValue', () => {
    const entry = { ...baseEntry, hostValue: 42 }
    expect(parseProxyWidgetErrorQuarantine([entry])).toEqual([entry])
  })

  it('parses a 2-tuple originalEntry', () => {
    const entry = { ...baseEntry, originalEntry: ['10', 'seed'] }
    expect(parseProxyWidgetErrorQuarantine([entry])).toEqual([entry])
  })

  it('parses a 3-tuple originalEntry', () => {
    const entry = { ...baseEntry, originalEntry: ['3', 'text', '1'] }
    expect(parseProxyWidgetErrorQuarantine([entry])).toEqual([entry])
  })

  it.each([
    'missingSourceNode',
    'missingSourceWidget',
    'missingSubgraphInput',
    'ambiguousSubgraphInput',
    'unlinkedSourceWidget',
    'primitiveBypassFailed'
  ] as const)('parses reason %s', (reason) => {
    const entry = { ...baseEntry, reason }
    expect(parseProxyWidgetErrorQuarantine([entry])).toEqual([entry])
  })

  it('parses JSON-string input', () => {
    const input = JSON.stringify([baseEntry])
    expect(parseProxyWidgetErrorQuarantine(input)).toEqual([baseEntry])
  })

  it('returns empty array for undefined', () => {
    expect(parseProxyWidgetErrorQuarantine(undefined)).toEqual([])
  })

  it('returns empty array for malformed JSON string', () => {
    expect(parseProxyWidgetErrorQuarantine('not-json{')).toEqual([])
  })

  it('returns empty array for non-array input', () => {
    expect(parseProxyWidgetErrorQuarantine(baseEntry)).toEqual([])
  })

  it('returns empty array when attemptedAtVersion is not 1', () => {
    const entry = { ...baseEntry, attemptedAtVersion: 2 }
    expect(parseProxyWidgetErrorQuarantine([entry])).toEqual([])
  })

  it('returns empty array when reason is not in the enum', () => {
    const entry = { ...baseEntry, reason: 'somethingElse' }
    expect(parseProxyWidgetErrorQuarantine([entry])).toEqual([])
  })

  it('returns empty array when originalEntry is malformed', () => {
    const entry = { ...baseEntry, originalEntry: ['only-one'] }
    expect(parseProxyWidgetErrorQuarantine([entry])).toEqual([])
  })
})
