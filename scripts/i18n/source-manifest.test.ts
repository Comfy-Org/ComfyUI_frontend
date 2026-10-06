import { describe, expect, it } from 'vitest'

import type { TokenViolation } from './protected-tokens'
import { formatTokenViolation } from './protected-tokens'
import type { SourceManifest } from './source-manifest'
import { loadManifest, splitViolations } from './source-manifest'

const filename = '/catalogs/.source-manifest.json'

const missingName = (...path: string[]): TokenViolation => ({
  path,
  code: 'missing-token',
  token: '{name}'
})

describe('loadManifest', () => {
  const sourceDigest = 'a'.repeat(64)
  const localeDigest = 'b'.repeat(64)
  const validFile = {
    source: { '["title"]': sourceDigest },
    locales: {
      ja: { fingerprints: { '["title"]': localeDigest }, reviewNeeded: [] }
    },
    knownViolations: []
  }

  it('parses the provided bytes, keeping fingerprints, duplicate baselines, and their locales', () => {
    const manifest: SourceManifest = {
      version: 3,
      files: {
        'main.json': {
          source: { '["title"]': sourceDigest, '["tos","body"]': localeDigest },
          locales: {
            ja: {
              fingerprints: { '["tos","body"]': sourceDigest },
              reviewNeeded: [['tos', 'body']]
            },
            'zh-CN': { fingerprints: {}, reviewNeeded: [] }
          },
          knownViolations: [
            { ...missingName('title'), locale: 'zh-CN' },
            { ...missingName('title'), locale: 'zh-CN' },
            { ...missingName('title'), locale: 'ja' },
            { ...missingName('a.b'), locale: 'ja' }
          ]
        }
      }
    }

    expect(loadManifest(filename, JSON.stringify(manifest))).toEqual(manifest)
  })

  it.for([
    { label: 'corrupt JSON', content: '{"version":', detail: 'JSON' },
    {
      label: 'a version 2 manifest',
      content: JSON.stringify({
        version: 2,
        files: { 'main.json': validFile }
      }),
      detail: '["version"]'
    },
    {
      label: 'missing source fingerprints',
      content: JSON.stringify({
        version: 3,
        files: { 'main.json': { ...validFile, source: undefined } }
      }),
      detail: '["files","main.json","source"]'
    },
    {
      label: 'missing locale fingerprints',
      content: JSON.stringify({
        version: 3,
        files: {
          'main.json': { ...validFile, locales: { ja: { reviewNeeded: [] } } }
        }
      }),
      detail: '["files","main.json","locales","ja","fingerprints"]'
    },
    {
      label: 'a truncated source fingerprint',
      content: JSON.stringify({
        version: 3,
        files: {
          'main.json': {
            ...validFile,
            source: { '["title"]': 'a'.repeat(40) }
          }
        }
      }),
      detail: '["files","main.json","source","[\\"title\\"]"]'
    },
    {
      label: 'an uppercase locale fingerprint',
      content: JSON.stringify({
        version: 3,
        files: {
          'main.json': {
            ...validFile,
            locales: {
              ja: {
                fingerprints: { '["title"]': 'B'.repeat(64) },
                reviewNeeded: []
              }
            }
          }
        }
      }),
      detail:
        '["files","main.json","locales","ja","fingerprints","[\\"title\\"]"]'
    },
    {
      label: 'a recorded locale blob',
      content: JSON.stringify({
        version: 3,
        files: {
          'main.json': {
            ...validFile,
            locales: {
              ja: { fingerprints: {}, blob: 'b'.repeat(40), reviewNeeded: [] }
            }
          }
        }
      }),
      detail: '["files","main.json","locales","ja"]'
    },
    {
      label: 'a baseline without a locale',
      content: JSON.stringify({
        version: 3,
        files: {
          'main.json': { ...validFile, knownViolations: [missingName('title')] }
        }
      }),
      detail: '["files","main.json","knownViolations",0,"locale"]'
    },
    {
      label: 'an unknown violation code',
      content: JSON.stringify({
        version: 3,
        files: {
          'main.json': {
            ...validFile,
            knownViolations: [
              { ...missingName('title'), code: 'renamed', locale: 'ja' }
            ]
          }
        }
      }),
      detail: '["files","main.json","knownViolations",0,"code"]'
    }
  ])(
    'fails closed on $label, naming the file and field',
    ({ content, detail }) => {
      expect(() => loadManifest(filename, content)).toThrow(
        `Cannot load source manifest ${filename}`
      )
      expect(() => loadManifest(filename, content)).toThrow(detail)
    }
  )
})

describe('splitViolations', () => {
  it.for([
    {
      label: 'one baseline entry exempts only one of two identical omissions',
      actual: [missingName('title'), missingName('title')],
      baseline: [missingName('title')]
    },
    {
      label: 'one baseline entry exempts only its own path',
      actual: [missingName('title'), missingName('subtitle')],
      baseline: [missingName('title')]
    }
  ])('$label', ({ actual, baseline }) => {
    expect(splitViolations(actual, baseline)).toEqual({
      known: [actual[0]],
      unexpected: [actual[1]],
      stale: []
    })
  })

  it('matches on structured identity, not rendered wording', () => {
    const literalDot = missingName('a.b')
    const nested = missingName('a', 'b')

    expect(formatTokenViolation(literalDot)).toBe(formatTokenViolation(nested))
    expect(splitViolations([nested], [literalDot])).toEqual({
      known: [],
      unexpected: [nested],
      stale: [literalDot]
    })
  })

  it.for<{ label: string; baseline: TokenViolation }>([
    {
      label: 'code',
      baseline: { ...missingName('title'), code: 'added-token' }
    },
    { label: 'token', baseline: { ...missingName('title'), token: '{count}' } }
  ])('does not exempt a violation with a different $label', ({ baseline }) => {
    expect(splitViolations([missingName('title')], [baseline])).toEqual({
      known: [],
      unexpected: [missingName('title')],
      stale: [baseline]
    })
  })
})
