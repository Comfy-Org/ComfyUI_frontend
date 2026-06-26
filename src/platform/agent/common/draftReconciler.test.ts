import { describe, expect, it } from 'vitest'

import type { DraftPatchEvent } from './agentProtocol'
import { reconcileDraftPatch } from './draftReconciler'

function patch(overrides: Partial<DraftPatchEvent> = {}): DraftPatchEvent {
  return {
    type: 'draft_patch',
    threadId: 't1',
    messageId: 'm1',
    workflowId: 'wf1',
    content: { nodes: [] },
    version: 8,
    baseVersion: 7,
    ...overrides
  }
}

describe('reconcileDraftPatch', () => {
  it('applies when the patch is based on the current tab version', () => {
    const result = reconcileDraftPatch(patch({ baseVersion: 7, version: 8 }), 7)
    expect(result).toEqual({ kind: 'apply', version: 8 })
  })

  it('flags a conflict when a concurrent edit advanced the tab', () => {
    // Agent started from v7, but the user pushed the tab to v8 mid-turn.
    const result = reconcileDraftPatch(patch({ baseVersion: 7, version: 9 }), 8)
    expect(result).toEqual({ kind: 'conflict' })
  })

  it('ignores a stale patch the tab already supersedes', () => {
    const result = reconcileDraftPatch(patch({ baseVersion: 7, version: 8 }), 8)
    expect(result).toEqual({ kind: 'stale' })
  })

  it('ignores an older duplicate patch', () => {
    const result = reconcileDraftPatch(
      patch({ baseVersion: 5, version: 6 }),
      10
    )
    expect(result).toEqual({ kind: 'stale' })
  })
})
