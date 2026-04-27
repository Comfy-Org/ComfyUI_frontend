import { describe, expect, it } from 'vitest'

import type { PendingWarnings } from '@/platform/workflow/management/stores/comfyWorkflow'
import {
  normalizePendingWarnings,
  updatePendingWarnings
} from '@/platform/workflow/core/utils/pendingWarnings'

describe('pendingWarnings utils', () => {
  it('normalizes missing or empty warning collections to null', () => {
    expect(normalizePendingWarnings(null)).toBeNull()
    expect(normalizePendingWarnings(undefined)).toBeNull()
    expect(
      normalizePendingWarnings({
        missingNodeTypes: [],
        missingModelCandidates: [],
        missingMediaCandidates: []
      })
    ).toBeNull()
  })

  it('drops empty warning fields while preserving populated fields', () => {
    const warnings = {
      missingNodeTypes: ['CustomNode'],
      missingModelCandidates: [],
      missingMediaCandidates: [
        {
          nodeId: '1',
          nodeType: 'LoadImage',
          widgetName: 'image',
          mediaType: 'image' as const,
          name: 'missing.png',
          isMissing: true
        }
      ]
    } satisfies PendingWarnings

    expect(normalizePendingWarnings(warnings)).toEqual({
      missingNodeTypes: ['CustomNode'],
      missingModelCandidates: undefined,
      missingMediaCandidates: warnings.missingMediaCandidates
    })
  })

  it('merges updates into existing warnings and removes stale empty state', () => {
    const workflow = {
      pendingWarnings: {
        missingNodeTypes: ['CustomNode'],
        missingModelCandidates: [
          {
            nodeId: '1',
            nodeType: 'CheckpointLoaderSimple',
            widgetName: 'ckpt_name',
            name: 'missing.safetensors',
            isMissing: true,
            isAssetSupported: true
          }
        ]
      } satisfies PendingWarnings | null
    }

    updatePendingWarnings(workflow, {
      missingModelCandidates: []
    })

    expect(workflow.pendingWarnings).toEqual({
      missingNodeTypes: ['CustomNode'],
      missingModelCandidates: undefined,
      missingMediaCandidates: undefined
    })

    updatePendingWarnings(workflow, {
      missingNodeTypes: []
    })

    expect(workflow.pendingWarnings).toBeNull()
  })

  it('does nothing when there is no workflow to update', () => {
    expect(() =>
      updatePendingWarnings(null, {
        missingNodeTypes: ['CustomNode']
      })
    ).not.toThrow()
  })
})
