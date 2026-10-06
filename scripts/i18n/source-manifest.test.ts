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
  it('parses the provided bytes, keeping duplicate baselines and their locales', () => {
    const manifest: SourceManifest = {
      version: 2,
      files: {
        'main.json': {
          locales: {
            ja: { reviewNeeded: [['tos', 'body']] },
            'zh-CN': { reviewNeeded: [] }
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

  const validFile = { locales: {}, knownViolations: [] }

  it.for([
    { label: 'corrupt JSON', content: '{"version":', detail: 'JSON' },
    {
      label: 'a version 1 manifest',
      content: JSON.stringify({
        version: 1,
        files: { 'main.json': 'a'.repeat(40) }
      }),
      detail: '["version"]'
    },
    {
      label: 'a recorded source blob',
      content: JSON.stringify({
        version: 2,
        files: { 'main.json': { ...validFile, source: 'a'.repeat(40) } }
      }),
      detail: '["files","main.json"]: Unrecognized key(s) in object: \'source\''
    },
    {
      label: 'a recorded locale blob',
      content: JSON.stringify({
        version: 2,
        files: {
          'main.json': {
            ...validFile,
            locales: { ja: { blob: 'b'.repeat(40), reviewNeeded: [] } }
          }
        }
      }),
      detail: '["files","main.json","locales","ja"]'
    },
    {
      label: 'a baseline without a locale',
      content: JSON.stringify({
        version: 2,
        files: {
          'main.json': { ...validFile, knownViolations: [missingName('title')] }
        }
      }),
      detail: '["files","main.json","knownViolations",0,"locale"]'
    },
    {
      label: 'an unknown violation code',
      content: JSON.stringify({
        version: 2,
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
