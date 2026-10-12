import { describe, expect, it } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import type {
  ComfyNode,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'

import { useWorkflowValidation } from './useWorkflowValidation'

function serialisedNode(
  slots: Pick<ComfyNode, 'id' | 'inputs' | 'outputs'>
): ComfyNode {
  return {
    flags: {},
    mode: 0,
    order: 0,
    pos: [0, 0],
    properties: {},
    size: [100, 100],
    type: 'TestNode',
    ...slots
  }
}

function workflowWithMissingOriginLink(): ComfyWorkflowJSON {
  return {
    groups: [],
    last_link_id: 1,
    last_node_id: 2,
    links: [[1, 1, 0, 2, 0, '*']],
    nodes: [
      serialisedNode({
        id: 1,
        outputs: [{ links: [], name: 'out', type: '*' }]
      }),
      serialisedNode({ id: 2, inputs: [{ link: 1, name: 'in', type: '*' }] })
    ],
    version: 0.4
  }
}

describe('useWorkflowValidation', () => {
  it('reports repaired links with translated toasts', async () => {
    await useWorkflowValidation().validateWorkflow(
      workflowWithMissingOriginLink()
    )

    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'warning',
        title: 'Workflow Validation'
      }),
      expect.objectContaining({
        description: 'Fixed 1 node connections and removed 0 invalid links.',
        kind: 'success',
        title: 'Workflow Links Fixed'
      })
    ])
  })

  it('shows no toast when silent', async () => {
    await useWorkflowValidation().validateWorkflow(
      workflowWithMissingOriginLink(),
      { silent: true }
    )

    expect(useToast().toasts).toEqual([])
  })
})
