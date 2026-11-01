import { describe, expect, it } from 'vitest'
import {
  validateComfyWorkflow
} from '@comfyorg/graph-model/workflowSchema'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { widgetId } from '@comfyorg/graph-model/widgetId'

const key = widgetId('root', toNodeId(1), 'steps')
const graph = {
  version: 0.4,
  last_node_id: 1,
  last_link_id: 0,
  nodes: [],
  links: []
}

describe('linearData.inputGroups schema', () => {
  it('preserves group IDs, labels and canonical widget identities', async () => {
    const inputGroups = [{
      id: 'group',
      name: 'Generation',
      items: [{ key, pairId: 'pair' }]
    }]
    const value = await validateComfyWorkflow({
      ...graph,
      extra: { linearData: { inputs: [[key, 'steps']], outputs: [], inputGroups } }
    })
    expect(value?.extra?.linearData?.inputGroups).toEqual(inputGroups)
  })

  it.for([
    { id: 'group', name: null, items: [{ key: 'invalid' }] },
    { id: 'group', name: null, items: null },
    { id: 'group', name: null, items: [{ key, pairId: 123 }] }
  ])('rejects malformed group metadata: %j', async (group) => {
    const value = await validateComfyWorkflow({
      ...graph,
      extra: { linearData: { inputs: [], outputs: [], inputGroups: [group] } }
    }, () => {})
    expect(value).toBeNull()
  })
})
