// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  ROUTER_PROVIDER_COVERAGE,
  ROUTER_PROVIDER_COVERAGE_VERIFIED_AT
} from './router-providers'

describe('Router provider coverage', () => {
  it('lists each model once, alphabetically', () => {
    const names = ROUTER_PROVIDER_COVERAGE.map((row) => row.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    expect(new Set(names).size).toBe(names.length)
    expect(ROUTER_PROVIDER_COVERAGE_VERIFIED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
