// @vitest-environment node

import { z } from 'astro/zod'
import { describe, expect, it } from 'vitest'

import {
  ROUTER_PROVIDER_COVERAGE,
  ROUTER_PROVIDER_COVERAGE_VERIFIED_AT
} from './router-providers'

const altProvidersSchema = z.object({
  'x-comfy-router-alt-providers': z
    .array(z.object({ provider: z.string() }))
    .default([])
})

function expectAlternateProviders(
  specs: string[],
  expected: readonly (readonly string[])[]
): void {
  const actual = specs.map((spec) =>
    altProvidersSchema
      .parse(JSON.parse(spec))
      ['x-comfy-router-alt-providers'].map(({ provider }) => provider)
      .sort()
  )
  expect(actual).toEqual(expected.map((providers) => [...providers].sort()))
}

describe('Router provider fixtures', () => {
  it('detects provider drift when the spec lists different alternate providers', () => {
    const spec = JSON.stringify({
      'x-comfy-router-alt-providers': [{ provider: 'anthropic' }]
    })

    expect(() => expectAlternateProviders([spec], [['openai']])).toThrow(
      "expected [ [ 'anthropic' ] ] to deeply equal [ [ 'openai' ] ]"
    )
  })
})

describe('Router provider coverage', () => {
  it('lists each model once, alphabetically', () => {
    const names = ROUTER_PROVIDER_COVERAGE.map((row) => row.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    expect(new Set(names).size).toBe(names.length)
    expect(ROUTER_PROVIDER_COVERAGE_VERIFIED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
