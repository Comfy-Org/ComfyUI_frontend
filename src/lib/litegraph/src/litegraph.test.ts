import { clamp } from 'es-toolkit/compat'
import { afterEach, beforeEach, describe, expect, vi } from 'vitest'

import {
  LiteGraphGlobal,
  LGraphCanvas,
  LiteGraph,
  LGraph
} from '@/lib/litegraph/src/litegraph'

import { LGraph as DirectLGraph } from '@/lib/litegraph/src/LGraph'

import { test } from './__fixtures__/testExtensions'

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

  describe('removed-API compatibility shims', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      warnSpy.mockRestore()
    })

    test('onDeprecationWarning remains a usable no-op for old extensions', () => {
      expect(() => LiteGraph.onDeprecationWarning.push(() => {})).not.toThrow()
      expect(LiteGraph.onDeprecationWarning).toBe(
        LiteGraph.onDeprecationWarning
      )
      expect(() => {
        LiteGraph.onDeprecationWarning = [() => {}]
      }).not.toThrow()
    })

    test('alwaysRepeatWarnings remains a usable no-op for old extensions', () => {
      expect(() => {
        LiteGraph.alwaysRepeatWarnings = true
      }).not.toThrow()
      expect(LiteGraph.alwaysRepeatWarnings).toBe(false)
    })
  })
})

describe('Import order dependency', () => {
  test('Imports reference the same types', ({ expect }) => {
    // Both imports should reference the same LGraph class
    expect(LiteGraph.LGraph).toBe(DirectLGraph)
    expect(LiteGraph.LGraph).toBe(LGraph)
  })
})
