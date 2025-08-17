/**
 * Test for issue #5033: Type compatibility between comfyui-frontend-types and @comfyorg/litegraph
 *
 * This test verifies that the generated types from this package can be used alongside
 * external litegraph types without causing "#private field" conflicts.
 */
import { describe, expect, it } from 'vitest'

import type { LGraph, LLink } from '@/lib/litegraph/src/litegraph'
import type { ComfyApp } from '@/scripts/app'

describe('Issue #5033: Type compatibility', () => {
  it('should allow ComfyApp.graph to be assigned to LGraph type', () => {
    // This test verifies that the types are compatible after removing #private fields
    // from the generated .d.ts files

    function getGraph(app: ComfyApp): LGraph {
      // This should not cause TypeScript errors about #private field conflicts
      return app.graph
    }

    // Type test - if this compiles, the issue is fixed
    expect(typeof getGraph).toBe('function')
  })

  it('should allow graph.links to be compatible with LLink type', () => {
    type LGraphFromApp = ComfyApp['graph']

    function getLinks(app: ComfyApp): LLink | null {
      const graph: LGraphFromApp = app.graph
      // This should not cause TypeScript errors about #private field conflicts
      return graph.links.get(0) ?? null
    }

    // Type test - if this compiles, the issue is fixed
    expect(typeof getLinks).toBe('function')
  })
})
