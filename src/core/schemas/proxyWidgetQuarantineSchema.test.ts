import { describe, expect, it, vi } from 'vitest'

import { parseProxyWidgetErrorQuarantine } from './proxyWidgetQuarantineSchema'
import type { ProxyWidgetQuarantineReason } from './proxyWidgetQuarantineSchema'

const baseEntry = {
  originalEntry: ['10', 'seed'] as [string, string],
  reason: 'missingSourceNode' as ProxyWidgetQuarantineReason,
  attemptedAtVersion: 1 as const
}

describe(parseProxyWidgetErrorQuarantine, () => {
  it.for([
    { name: 'without hostValue', entry: baseEntry },
    { name: 'with hostValue', entry: { ...baseEntry, hostValue: 42 } },
    {
      name: 'with 3-tuple originalEntry',
      entry: { ...baseEntry, originalEntry: ['3', 'text', '1'] }
    }
  ])('parses a valid entry $name', ({ entry }) => {
    expect(parseProxyWidgetErrorQuarantine([entry])).toEqual([entry])
  })

  it.for([
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

  it('returns empty array for undefined without warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(parseProxyWidgetErrorQuarantine(undefined)).toEqual([])

    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it.for([
    { name: 'malformed JSON string', input: 'not-json{' },
    { name: 'non-array input', input: baseEntry },
    {
      name: 'attemptedAtVersion is not 1',
      input: [{ ...baseEntry, attemptedAtVersion: 2 }]
    },
    {
      name: 'reason is not in the enum',
      input: [{ ...baseEntry, reason: 'somethingElse' }]
    },
    {
      name: 'originalEntry is malformed',
      input: [{ ...baseEntry, originalEntry: ['only-one'] }]
    }
  ])('returns empty array when $name', ({ input }) => {
    expect(parseProxyWidgetErrorQuarantine(input)).toEqual([])
  })
})
