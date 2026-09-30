// @vitest-environment node

import { z } from 'astro/zod'
import { describe, expect, it } from 'vitest'

import {
  ROUTER_PROVIDER_COVERAGE,
  ROUTER_PROVIDER_COVERAGE_VERIFIED_AT
} from './router-providers'

// The per-model API spec, as the backend publishes it for the docs site.
const ROUTER_SCHEMAS =
  'https://raw.githubusercontent.com/Comfy-Org/docs/main/router-schemas'

// The API spec and the docs are the source of truth and live outside this
// repository, so the drift checks reach the network. They run in CI and skip
// elsewhere, or when a source cannot be fetched, so an outage never fails a
// build: the day the spec changes, CI is where it shows.
const skipReason = process.env.CI
  ? null
  : 'checks the published API spec; runs in CI only (set CI=1 to run it here)'

async function fetchDocs(url: string): Promise<string | null> {
  let response: Response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  } catch {
    return null
  }
  if (!response.ok) throw new Error(`${url} responded ${response.status}`)
  return response.text()
}

describe('Router provider coverage', () => {
  it('lists each model once, alphabetically', () => {
    const names = ROUTER_PROVIDER_COVERAGE.map((row) => row.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    expect(new Set(names).size).toBe(names.length)
    expect(ROUTER_PROVIDER_COVERAGE_VERIFIED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("matches each model's alternate providers in the API spec", async (ctx) => {
    if (skipReason) return ctx.skip(skipReason)
    const specs = await Promise.all(
      ROUTER_PROVIDER_COVERAGE.map((row) =>
        fetchDocs(`${ROUTER_SCHEMAS}/${row.modelId}.json`)
      )
    )
    if (specs.includes(null)) return ctx.skip('could not fetch the API spec')

    const altProviders = z.object({
      'x-comfy-router-alt-providers': z
        .array(z.object({ provider: z.string() }))
        .default([])
    })
    expect(
      specs.map((spec) =>
        altProviders
          .parse(JSON.parse(spec ?? '{}'))
          ['x-comfy-router-alt-providers'].map(({ provider }) => provider)
          .sort()
      )
    ).toEqual(ROUTER_PROVIDER_COVERAGE.map((row) => [...row.providers].sort()))
  })
})
