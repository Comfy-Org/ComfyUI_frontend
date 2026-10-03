import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'
import { api } from '@/scripts/api'

// Tests for the workflow_metadata field api.queuePrompt sends; fetchApi is stubbed.
const WORKFLOW_ID = '0199e3a3-6c01-7000-8000-c1a1f7a8d9b2'
const EMPTY_PROMPT: ComfyApiWorkflow = {}

const promptResponse = () =>
  ({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ prompt_id: 'p1', number: 1, node_errors: {} })
  }) as unknown as Response

function workflow(id?: string): ComfyWorkflowJSON {
  return {
    id,
    revision: 0,
    last_node_id: 0,
    last_link_id: 0,
    nodes: [],
    links: [],
    groups: [],
    config: {},
    extra: {},
    version: 1
  }
}

function sentBody(
  fetchApiSpy: ReturnType<typeof vi.spyOn>
): Record<string, unknown> {
  const [, init] = fetchApiSpy.mock.calls[0] as [string, RequestInit]
  return JSON.parse(String(init.body)) as Record<string, unknown>
}

describe('api.queuePrompt workflow_metadata', () => {
  let fetchApiSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchApiSpy = vi.spyOn(api, 'fetchApi').mockResolvedValue(promptResponse())
  })

  it('sends the workflow id as opaque metadata', async () => {
    await api.queuePrompt(0, {
      output: EMPTY_PROMPT,
      workflow: workflow(WORKFLOW_ID)
    })

    expect(sentBody(fetchApiSpy).workflow_metadata).toEqual({
      workflow_id: WORKFLOW_ID
    })
  })

  it('omits the field entirely when the workflow has no id', async () => {
    await api.queuePrompt(0, {
      output: EMPTY_PROMPT,
      workflow: workflow(undefined)
    })

    expect(sentBody(fetchApiSpy)).not.toHaveProperty('workflow_metadata')
  })

  it('still sends the id inside extra_pnginfo for older backends', async () => {
    await api.queuePrompt(0, {
      output: EMPTY_PROMPT,
      workflow: workflow(WORKFLOW_ID)
    })

    const body = sentBody(fetchApiSpy) as {
      extra_data: { extra_pnginfo: { workflow: { id?: string } } }
    }
    expect(body.extra_data.extra_pnginfo.workflow.id).toBe(WORKFLOW_ID)
  })
})
