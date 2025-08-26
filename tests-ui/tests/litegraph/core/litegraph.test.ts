import { clamp } from 'es-toolkit/compat'
import { beforeEach, describe, expect, vi } from 'vitest'

import { LiteGraphGlobal } from '@/lib/litegraph/src/litegraph'
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'

import { test } from './fixtures/testExtensions'

describe('Litegraph module', () => {
  test('contains a global export', ({ expect }) => {
    expect(LiteGraph).toBeInstanceOf(LiteGraphGlobal)
    expect(LiteGraph.LGraphCanvas).toBe(LGraphCanvas)
  })

  test('has the same structure', ({ expect }) => {
    const lgGlobal = new LiteGraphGlobal()
    expect(lgGlobal).toMatchSnapshot('minLGraph')
  })

  test('clamps values', () => {
    expect(clamp(-1.124, 13, 24)).toStrictEqual(13)
    expect(clamp(Infinity, 18, 29)).toStrictEqual(29)
  })
})

describe('Import order dependency', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  test('Imports without error when entry point is imported first', async ({
    expect
  }) => {
    async function importNormally() {
      const entryPointImport = await import('@/lib/litegraph/src/litegraph')
      const directImport = await import('@/lib/litegraph/src/LGraph')

      // Sanity check that imports were cleared.
      expect(Object.is(LiteGraph, entryPointImport.LiteGraph)).toBe(false)
      expect(Object.is(LiteGraph.LGraph, directImport.LGraph)).toBe(false)
    }

    await expect(importNormally()).resolves.toBeUndefined()
  })
})
