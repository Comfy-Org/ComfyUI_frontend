import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { useWorkflowValidation } from './useWorkflowValidation'

const reportError = vi.fn()

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: (...args: unknown[]) => reportError(...args)
}))

function createNode(id: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    type: 'TestNode',
    pos: [0, 0],
    size: [100, 100],
    flags: {},
    order: 0,
    mode: 0,
    properties: {},
    ...extra
  }
}

function createWorkflow(
  nodes: ReturnType<typeof createNode>[],
  links: unknown[]
): ComfyWorkflowJSON {
  return {
    last_node_id: 2,
    last_link_id: 1,
    nodes,
    links,
    groups: [],
    config: {},
    extra: {},
    version: 0.4
  } as unknown as ComfyWorkflowJSON
}

const intactWorkflow = () =>
  createWorkflow(
    [
      createNode(1, { outputs: [{ name: 'out', type: '*', links: [1] }] }),
      createNode(2, { inputs: [{ name: 'in', type: '*', link: 1 }] })
    ],
    [[1, 1, 0, 2, 0, '*']]
  )

/** Link 1 points at node 2, which does not exist. */
const corruptWorkflow = () =>
  createWorkflow(
    [createNode(1, { outputs: [{ name: 'out', type: '*', links: [1] }] })],
    [[1, 1, 0, 2, 0, '*']]
  )

describe('useWorkflowValidation', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('reports graph corruption found while loading a workflow', async () => {
    await useWorkflowValidation().validateWorkflow(corruptWorkflow())

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Workflow loaded with corrupt links'
      }),
      expect.objectContaining({
        errorType: 'workflow_link_corruption',
        level: 'warning',
        tags: { patched: 1, deleted: 1, unrepaired: false, silent: false }
      })
    )
  })

  it('still reports corruption when validation is silenced', async () => {
    await useWorkflowValidation().validateWorkflow(corruptWorkflow(), {
      silent: true
    })

    expect(reportError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        errorType: 'workflow_link_corruption',
        tags: expect.objectContaining({ silent: true })
      })
    )
  })

  it('stays quiet for an intact workflow', async () => {
    await useWorkflowValidation().validateWorkflow(intactWorkflow())

    expect(reportError).not.toHaveBeenCalled()
  })
})
