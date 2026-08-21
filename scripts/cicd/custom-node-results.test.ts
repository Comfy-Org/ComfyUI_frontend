import { describe, expect, it } from 'vitest'

import {
  parseStats,
  parseTierSessions,
  validateOrdinaryResult,
  validateProofResult
} from './custom-node-results'

describe('custom-node result policy', () => {
  const green = { expected: 30, unexpected: 0, flaky: 0, skipped: 0 }

  it('parses exact Playwright totals', () => {
    expect(parseStats({ stats: green, ignored: true })).toEqual(green)
    expect(() => parseStats({ stats: { ...green, skipped: -1 } })).toThrow(
      /non-negative/
    )
    expect(() => parseStats({})).toThrow(/stats/)
  })

  it('rejects count loss and every non-green result kind', () => {
    expect(() => validateOrdinaryResult(green, 30)).not.toThrow()
    expect(() => validateOrdinaryResult(green, 31)).toThrow(/collected/)
    expect(() =>
      validateOrdinaryResult({ ...green, unexpected: 1 }, undefined)
    ).toThrow(/failed/)
    expect(() =>
      validateOrdinaryResult({ ...green, skipped: 1 }, undefined)
    ).toThrow(/skipped/)
    expect(() =>
      validateOrdinaryResult({ ...green, flaky: 1 }, undefined)
    ).toThrow(/retry/)
  })

  it('extracts independent tier sessions', () => {
    expect(
      parseTierSessions(
        '[tier-session] pid=12 tier=S1 pageId=a\n[tier-session] pid=13 tier=S2 pageId=b\n'
      )
    ).toEqual([
      { pid: '12', tier: 'S1', pageId: 'a' },
      { pid: '13', tier: 'S2', pageId: 'b' }
    ])
  })

  it('requires one attributable failure and independent tier sessions', () => {
    const failure = '[comfyui-impact-pack] ImpactInt: Vue mounts 0 of 1 widgets'
    const result = {
      stats: { expected: 3, unexpected: 1, flaky: 0, skipped: 0 },
      suites: [
        {
          title:
            'S1: every enrolled registered node mounts on the canvas renderer',
          tests: [{ status: 'expected' }]
        },
        {
          title:
            'S2: every enrolled registered node mounts on the DOM renderer',
          tests: [
            {
              status: 'unexpected',
              results: [
                {
                  error: { message: failure },
                  attachments: [
                    {
                      name: 's2-failures.json',
                      contentType: 'application/json',
                      body: Buffer.from(JSON.stringify([failure])).toString(
                        'base64'
                      )
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          title:
            'S3: enrolled registered-node save/reload outcomes match exact contracts',
          tests: [{ status: 'expected' }]
        },
        {
          title: 'S9: calibrated model-free node corpus executes',
          tests: [{ status: 'expected' }]
        }
      ]
    }
    const log = [
      '[tier-session] pid=10 tier=S1 pageId=a',
      '[tier-session] pid=10 tier=S2 pageId=b',
      '[tier-session] pid=11 tier=S3 pageId=c',
      '[tier-session] pid=11 tier=S9 pageId=d'
    ].join('\n')
    expect(
      validateProofResult({
        result,
        row: '2',
        expectedCollected: 4,
        suiteOutcome: 'failure',
        log
      })
    ).toContain(failure)
    expect(() =>
      validateProofResult({
        result,
        row: '2',
        expectedCollected: 4,
        suiteOutcome: 'success',
        log
      })
    ).toThrow(/did not break/)
  })
})
