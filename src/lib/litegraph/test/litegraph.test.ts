import { clamp } from 'es-toolkit/compat'
import { beforeEach, describe, expect, vi } from 'vitest'

import { LiteGraphGlobal } from '@/lib/litegraph/src/LiteGraphGlobal'
import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

import { LiteGraphInternal } from '../src/LiteGraphInternal'
import { test } from './testExtensions'

describe('Litegraph module', () => {
  test('contains a global export', ({ expect }) => {
    expect(LiteGraphInternal).toBeInstanceOf(LiteGraphGlobal)
    expect(LiteGraphInternal.LGraphCanvas).toBe(LGraphCanvas)
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
      expect(Object.is(LiteGraphInternal, entryPointImport.LiteGraph)).toBe(
        false
      )
      expect(Object.is(LiteGraphInternal.LGraph, directImport.LGraph)).toBe(
        false
      )
    }

    await expect(importNormally()).resolves.toBeUndefined()
  })
})
