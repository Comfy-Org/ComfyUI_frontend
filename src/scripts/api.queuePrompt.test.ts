import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'

import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { zeroUuid } from '@comfyorg/graph-model/uuid'
import { api } from '@/scripts/api'

function promptResponse() {
  return Response.json({ prompt_id: 'job-1', node_errors: {} })
}

function workflowWithId(id: string | undefined): ComfyWorkflowJSON {
  return {
    id,
    revision: 0,
    last_node_id: 0,
    last_link_id: 0,
    nodes: [],
    links: [],
    groups: [],
    extra: {},
    version: 0.4
  }
}

describe('api queuePrompt workflow_metadata', () => {
  let fetchApiSpy: MockInstance<typeof api.fetchApi>

  beforeEach(() => {
    fetchApiSpy = vi.spyOn(api, 'fetchApi').mockResolvedValue(promptResponse())
  })

  async function postedBody(id: string | undefined) {
    await api.queuePrompt(0, {
      output: {},
      workflow: workflowWithId(id)
    })
    const [, init] = fetchApiSpy.mock.calls[0]
    if (typeof init?.body !== 'string')
      throw new Error('Expected JSON request body')
    return JSON.parse(init.body)
  }

  it.for([
    {
      name: 'a routable workflow id',
      id: '11111111-2222-3333-4444-555555555555'
    },
    { name: 'an id the server did not normalise', id: 'graph-7' }
  ])('sends $name as workflow_metadata', async ({ id }) => {
    expect(await postedBody(id)).toMatchObject({
      workflow_metadata: { workflow_id: id }
    })
  })

  it.for([
    { name: 'the all-zero sentinel', id: zeroUuid },
    { name: 'an absent id', id: undefined },
    { name: 'an empty id', id: '' }
  ])('omits workflow_metadata for $name', async ({ id }) => {
    expect(await postedBody(id)).not.toHaveProperty('workflow_metadata')
  })

  it('still carries the graph under extra_pnginfo when the id is withheld', async () => {
    const body = await postedBody(zeroUuid)

    expect(body.extra_data.extra_pnginfo.workflow.id).toBe(zeroUuid)
  })
})
