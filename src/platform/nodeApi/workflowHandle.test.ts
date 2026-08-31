import { describe, expect, it, vi } from 'vitest'

import type { LGraph } from '@/lib/litegraph/src/LGraph'

import { createWorkflowApi } from './workflowHandle'

const noGraph = () => undefined as unknown as LGraph | null | undefined

describe('WorkflowHandle.documentId', () => {
  it('reads through to the host-supplied reader', () => {
    // The handle does not mint or track anything itself — the loaded-workflow
    // lifecycle is `appReady`'s (one call site, `loadGraphData`'s tail),
    // and this is a read of it, not a second source of truth.
    const reader = vi.fn(() => 'doc-1')
    const api = createWorkflowApi(noGraph, undefined, reader)

    expect(api.documentId()).toBe('doc-1')
    expect(reader).toHaveBeenCalledTimes(1)
  })

  it('is undefined before any workflow has loaded', () => {
    const api = createWorkflowApi(noGraph, undefined, () => undefined)

    expect(api.documentId()).toBeUndefined()
  })
})
