import { liftNodeErrorsToBoundary } from '@/core/graph/subgraph/liftNodeErrorsToBoundary'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestRootGraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { scanAllModelCandidates } from '@/platform/missingModel/missingModelScan'
import { toNodeId } from '@/types/nodeId'
import { nodeError, validationError } from '@/utils/__tests__/nodeErrorHelpers'

/**
 * A checkpoint loader whose node id cannot be normalized to an execution id,
 * run through the real scan and lift pipeline. Callers that module-mock
 * graphTraversalUtil must stub getExecutionIdByNode themselves.
 */
export function createUnnormalisableModelErrorFixture() {
  const rootGraph = createTestRootGraph()
  const node = new LGraphNode('CheckpointLoaderSimple')
  node.id = toNodeId('not::a-node')
  const input = node.addInput('ckpt_name', 'COMBO')
  const widget = node.addWidget(
    'combo',
    'ckpt_name',
    'missing.safetensors',
    () => {},
    { values: ['present.safetensors'] }
  )
  input.widget = { name: widget.name }
  rootGraph.add(node)

  return {
    missingModels: scanAllModelCandidates(rootGraph, () => false),
    nodeErrors: liftNodeErrorsToBoundary(rootGraph, {
      'not::a-node': nodeError(
        [validationError('value_not_in_list', 'ckpt_name')],
        'CheckpointLoaderSimple'
      )
    })
  }
}
