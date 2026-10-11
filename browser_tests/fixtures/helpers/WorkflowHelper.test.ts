// @vitest-environment node
import { fromPartial } from '@total-typescript/shoehorn'
import { Storage } from 'happy-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import booleanWorkflow from '@e2e/assets/inputs/boolean_input.json'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { WorkflowHelper } from '@e2e/fixtures/helpers/WorkflowHelper'
import type { DraftPayloadV2 } from '@/platform/workflow/persistence/base/draftTypes'

describe('WorkflowHelper draft workflows', () => {
  let workflow: WorkflowHelper

  beforeEach(() => {
    vi.stubGlobal('localStorage', new Storage())
    workflow = new WorkflowHelper(
      fromPartial<ComfyPage>({
        page: {
          evaluate: vi.fn(async (callback: () => unknown) => callback())
        }
      })
    )
  })

  it('reads saved Boolean values across drafts and ignores other storage keys', async () => {
    const editedWorkflow = {
      ...booleanWorkflow,
      nodes: booleanWorkflow.nodes.map((node) => ({
        ...node,
        widgets_values: [false]
      }))
    }
    localStorage.setItem('Comfy.Workflow.DraftIndex.v2:ws-1', 'not a payload')
    localStorage.setItem('unrelated', 'not JSON')
    localStorage.setItem(
      'Comfy.Workflow.Draft.v2:ws-1:original',
      JSON.stringify({
        data: JSON.stringify(booleanWorkflow),
        updatedAt: 1
      } satisfies DraftPayloadV2)
    )
    localStorage.setItem(
      'Comfy.Workflow.Draft.v2:ws-2:edited',
      JSON.stringify({
        data: JSON.stringify(editedWorkflow),
        updatedAt: 2
      } satisfies DraftPayloadV2)
    )

    expect(await workflow.getDraftWorkflows()).toEqual([
      booleanWorkflow,
      editedWorkflow
    ])
  })

  it('returns no workflows when no draft has been persisted', async () => {
    expect(await workflow.getDraftWorkflows()).toEqual([])
  })

  it('skips a draft removed before its payload is read', async () => {
    localStorage.setItem('Comfy.Workflow.Draft.v2:ws-1:removed', 'not JSON')
    vi.spyOn(localStorage, 'getItem').mockReturnValueOnce(null)

    expect(await workflow.getDraftWorkflows()).toEqual([])
  })

  it.for([
    { name: 'payload', rawPayload: 'not JSON' },
    {
      name: 'workflow',
      rawPayload: JSON.stringify({
        data: 'not JSON',
        updatedAt: 1
      } satisfies DraftPayloadV2)
    }
  ])('rejects malformed $name JSON', async ({ rawPayload }) => {
    localStorage.setItem('Comfy.Workflow.Draft.v2:ws-1:invalid', rawPayload)

    await expect(workflow.getDraftWorkflows()).rejects.toThrow(SyntaxError)
  })
})
