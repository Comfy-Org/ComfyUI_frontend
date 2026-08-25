import { describe, expect, it } from 'vitest'

import type { PendingWarnings } from '@/platform/workflow/management/stores/comfyWorkflow'
import {
  dedupeMissingNodeTypes,
  normalizePendingWarnings,
  removePendingMissingNodeTypesByExecutionIdPrefix,
  removePendingMissingNodeTypesByNodeId,
  removePendingMissingNodeTypesByType,
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

    expect(normalizePendingWarnings(warnings)).toStrictEqual({
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
      } satisfies PendingWarnings
    }

    updatePendingWarnings(workflow, {
      missingModelCandidates: []
    })

    expect(workflow.pendingWarnings).toStrictEqual({
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

  describe('missing node type helpers', () => {
    it('replaces and deduplicates node types using display-store identity', () => {
      const types = [
        'GroupNode',
        'GroupNode',
        { type: 'NodeA', nodeId: '1', isReplaceable: false },
        { type: 'NodeA', nodeId: '1', isReplaceable: true },
        { type: 'NodeA', nodeId: '2', isReplaceable: false },
        { type: 'NodeB', isReplaceable: false },
        { type: 'NodeB', isReplaceable: true }
      ]

      expect(dedupeMissingNodeTypes(types)).toStrictEqual([
        'GroupNode',
        { type: 'NodeA', nodeId: '1', isReplaceable: false },
        { type: 'NodeA', nodeId: '2', isReplaceable: false },
        { type: 'NodeB', isReplaceable: false }
      ])
    })

    it('keeps string, node ID, and type-only identities separate', () => {
      expect(
        dedupeMissingNodeTypes([
          '1',
          { type: 'NodeA', nodeId: 1, isReplaceable: false },
          { type: 'NodeA', nodeId: '1', isReplaceable: true },
          { type: '1', isReplaceable: false }
        ])
      ).toStrictEqual([
        '1',
        { type: 'NodeA', nodeId: 1, isReplaceable: false },
        { type: '1', isReplaceable: false }
      ])
    })

    describe('remove by type', () => {
      it('removes matching object types', () => {
        const remaining = removePendingMissingNodeTypesByType(
          [
            { type: 'NodeA', nodeId: '1', isReplaceable: false },
            { type: 'NodeB', nodeId: '2', isReplaceable: false },
            { type: 'NodeC', nodeId: '3', isReplaceable: false }
          ],
          ['NodeA', 'NodeC']
        )

        expect(remaining).toStrictEqual([
          { type: 'NodeB', nodeId: '2', isReplaceable: false }
        ])
      })

      it('returns an empty list when all types are removed', () => {
        expect(
          removePendingMissingNodeTypesByType(
            [{ type: 'NodeA', nodeId: '1', isReplaceable: false }],
            ['NodeA']
          )
        ).toStrictEqual([])
      })

      it('returns an empty list when there are no node warnings', () => {
        expect(
          removePendingMissingNodeTypesByType(undefined, ['NodeA'])
        ).toStrictEqual([])
      })

      it('preserves non-matching types', () => {
        const types = [{ type: 'NodeA', nodeId: '1', isReplaceable: false }]

        expect(
          removePendingMissingNodeTypesByType(types, ['NonExistent'])
        ).toStrictEqual(types)
      })

      it('removes matching string entries', () => {
        expect(
          removePendingMissingNodeTypesByType(
            ['StringNodeA', 'StringNodeB'],
            ['StringNodeA']
          )
        ).toStrictEqual(['StringNodeB'])
      })
    })

    describe('remove by node ID', () => {
      it('removes entries matching the node ID', () => {
        expect(
          removePendingMissingNodeTypesByNodeId(
            [
              { type: 'NodeA', nodeId: '1', isReplaceable: false },
              { type: 'NodeB', nodeId: '2', isReplaceable: false }
            ],
            '1'
          )
        ).toStrictEqual([{ type: 'NodeB', nodeId: '2', isReplaceable: false }])
      })

      it('matches numeric node IDs against string execution IDs', () => {
        expect(
          removePendingMissingNodeTypesByNodeId(
            [
              { type: 'NodeA', nodeId: 1, isReplaceable: false },
              { type: 'NodeB', nodeId: 2, isReplaceable: false }
            ],
            '1'
          )
        ).toStrictEqual([{ type: 'NodeB', nodeId: 2, isReplaceable: false }])
      })

      it('preserves string entries', () => {
        expect(
          removePendingMissingNodeTypesByNodeId(
            [
              'StringNode',
              { type: 'NodeA', nodeId: '1', isReplaceable: false }
            ],
            '1'
          )
        ).toStrictEqual(['StringNode'])
      })

      it('preserves entries with different node IDs', () => {
        const types = [
          { type: 'NodeA', nodeId: '1', isReplaceable: false },
          { type: 'NodeB', nodeId: '2', isReplaceable: false },
          { type: 'NodeC', nodeId: '3', isReplaceable: false }
        ]

        expect(removePendingMissingNodeTypesByNodeId(types, '4')).toStrictEqual(
          types
        )
      })

      it('preserves entries without a node ID', () => {
        const types = [{ type: 'NoId', isReplaceable: false }]

        expect(
          removePendingMissingNodeTypesByNodeId(types, 'undefined')
        ).toStrictEqual(types)
      })

      it('returns an empty list when every object entry matches', () => {
        expect(
          removePendingMissingNodeTypesByNodeId(
            [{ type: 'NodeA', nodeId: '1', isReplaceable: false }],
            '1'
          )
        ).toStrictEqual([])
      })

      it('returns an empty list when there are no node warnings', () => {
        expect(
          removePendingMissingNodeTypesByNodeId(undefined, '1')
        ).toStrictEqual([])
      })
    })

    describe('remove by execution ID prefix', () => {
      it('removes object entries whose node ID starts with the prefix', () => {
        expect(
          removePendingMissingNodeTypesByExecutionIdPrefix(
            [
              { type: 'A', nodeId: '65:70:63', isReplaceable: false },
              { type: 'B', nodeId: '65:70:64', isReplaceable: false },
              { type: 'C', nodeId: '65:80:5', isReplaceable: false }
            ],
            '65:70:'
          )
        ).toStrictEqual([
          { type: 'C', nodeId: '65:80:5', isReplaceable: false }
        ])
      })

      it('removes deeply nested interior entries', () => {
        expect(
          removePendingMissingNodeTypesByExecutionIdPrefix(
            [
              { type: 'A', nodeId: '65:70:63', isReplaceable: false },
              { type: 'B', nodeId: '65:70:80:5', isReplaceable: false },
              { type: 'C', nodeId: '65:71:63', isReplaceable: false }
            ],
            '65:70:'
          )
        ).toStrictEqual([
          { type: 'C', nodeId: '65:71:63', isReplaceable: false }
        ])
      })

      it('does not match siblings sharing a numeric prefix', () => {
        expect(
          removePendingMissingNodeTypesByExecutionIdPrefix(
            [
              { type: 'A', nodeId: '65:70:1', isReplaceable: false },
              { type: 'B', nodeId: '65:705:1', isReplaceable: false },
              { type: 'C', nodeId: '65:70', isReplaceable: false }
            ],
            '65:70:'
          )
        ).toStrictEqual([
          { type: 'B', nodeId: '65:705:1', isReplaceable: false },
          { type: 'C', nodeId: '65:70', isReplaceable: false }
        ])
      })

      it('preserves strings and entries without a node ID', () => {
        expect(
          removePendingMissingNodeTypesByExecutionIdPrefix(
            [
              'StringNode',
              { type: 'NoId', isReplaceable: false },
              { type: 'A', nodeId: '65:70:1', isReplaceable: false }
            ],
            '65:70:'
          )
        ).toStrictEqual(['StringNode', { type: 'NoId', isReplaceable: false }])
      })

      it('returns an empty list when every entry matches', () => {
        expect(
          removePendingMissingNodeTypesByExecutionIdPrefix(
            [
              { type: 'A', nodeId: '65:70:63', isReplaceable: false },
              { type: 'B', nodeId: '65:70:64', isReplaceable: false }
            ],
            '65:70:'
          )
        ).toStrictEqual([])
      })

      it('returns an empty list when there are no node warnings', () => {
        expect(
          removePendingMissingNodeTypesByExecutionIdPrefix(undefined, '65:70:')
        ).toStrictEqual([])
      })
    })
  })
})
