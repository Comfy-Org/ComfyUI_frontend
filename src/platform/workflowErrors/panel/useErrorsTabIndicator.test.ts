import { describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import { app } from '@/scripts/app'
import '@/scripts/changeTracker'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { getExecutionIdByNode } from '@/utils/graphTraversalUtil'
import { nodeError, validationError } from '@/utils/__tests__/nodeErrorHelpers'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

import { useErrorsTabIndicator } from './useErrorsTabIndicator'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))

function addNode(id: number) {
  const node = new LGraphNode('CheckpointLoaderSimple')
  node.id = toNodeId(id)
  app.rootGraph.add(node)
  return node
}

function missingCheckpointOn(nodeId: string) {
  useMissingModelStore().setMissingModels([
    {
      nodeId,
      nodeType: 'CheckpointLoaderSimple',
      widgetName: 'ckpt_name',
      name: 'missing.safetensors',
      isMissing: true,
      isAssetSupported: false
    }
  ])
}

function indicatorFor(selectedNodes: LGraphNode[]) {
  return useErrorsTabIndicator({
    hasSelection: selectedNodes.length > 0,
    selectedNodes,
    currentGraph: () => app.rootGraph
  })
}

describe('useErrorsTabIndicator', () => {
  it('reports any workflow issue when nothing is selected', () => {
    addNode(1)
    const indicator = indicatorFor([])
    expect(indicator.hasRelevantErrors.value).toBe(false)

    missingCheckpointOn('1')

    expect(indicator.hasRelevantErrors.value).toBe(true)
    expect(indicator.hasBlockingError.value).toBe(false)
  })

  it('ignores issues on nodes outside the selection', () => {
    addNode(1)
    const selected = addNode(2)
    useExecutionErrorStore().recordNodeErrors({
      '1': nodeError(
        [validationError('value_not_in_list', 'ckpt_name')],
        'CheckpointLoaderSimple'
      )
    })

    expect(indicatorFor([selected]).hasRelevantErrors.value).toBe(false)
  })

  it('reports a blocking validation error on a selected node', () => {
    const selected = addNode(1)
    useExecutionErrorStore().recordNodeErrors({
      '1': nodeError(
        [validationError('value_not_in_list', 'ckpt_name')],
        'CheckpointLoaderSimple'
      )
    })

    const indicator = indicatorFor([selected])

    expect(indicator.hasRelevantErrors.value).toBe(true)
    expect(indicator.hasBlockingError.value).toBe(true)
  })

  it('reports a missing model on a selected node as setup, not blocking', () => {
    const selected = addNode(1)
    missingCheckpointOn('1')

    const indicator = indicatorFor([selected])

    expect(indicator.hasRelevantErrors.value).toBe(true)
    expect(indicator.hasBlockingError.value).toBe(false)
  })

  it('treats a node error absorbed by a missing model as setup', () => {
    const selected = addNode(1)
    missingCheckpointOn('1')
    useExecutionErrorStore().recordNodeErrors({
      '1': nodeError(
        [validationError('value_not_in_list', 'ckpt_name')],
        'CheckpointLoaderSimple'
      )
    })

    expect(indicatorFor([selected]).hasBlockingError.value).toBe(false)
  })

  it('treats a runtime error with an unnormalisable node id as blocking', () => {
    useExecutionErrorStore().recordExecutionError({
      prompt_id: 'abc',
      node_id: 'not::a-node',
      node_type: 'KSampler',
      executed: [],
      exception_message: 'Execution failed',
      exception_type: 'RuntimeError',
      traceback: [],
      timestamp: 0
    })

    const indicator = indicatorFor([])

    expect(indicator.hasRelevantErrors.value).toBe(true)
    expect(indicator.hasBlockingError.value).toBe(true)
  })

  it('reports a pending error scan on a selected node until it finishes', () => {
    const selected = addNode(1)
    const executionId = getExecutionIdByNode(app.rootGraph, selected)
    if (!executionId) throw new Error('Expected an execution id')
    const finishScan = useExecutionErrorStore().beginAddedNodeErrorScan(
      app.rootGraph,
      executionId
    )
    const indicator = indicatorFor([selected])

    expect(indicator.hasPendingErrorScanSelected.value).toBe(true)

    finishScan()

    expect(indicator.hasPendingErrorScanSelected.value).toBe(false)
  })
})
