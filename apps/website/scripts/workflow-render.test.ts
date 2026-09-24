// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { workflowDetailsBySlug } from '../src/config/workshop-workflow-content'
import { initialWorkshopPageState } from '../src/config/workshop-page-state'
import { urlUploadField } from '../src/config/workshop-playground'
import { prepareWorkflowRender } from '../src/config/workflow-render'
import type {
  WorkflowRun,
  WorkflowRunRequest
} from '../src/config/workshop-workflow-response'
import { workflow_for_model, workflow_render } from './workflow-render'

describe('CLI workflow rendering', () => {
  it.for([...workflowDetailsBySlug.values()])(
    'uses the browser defaults and request contract for $slug',
    async (model) => {
      const initial = initialWorkshopPageState(model)
      expect(workflow_for_model(model.slug)).toEqual(initial.values)
      const inputs = Object.fromEntries(
        initial.schema
          .filter((field) => urlUploadField(field))
          .map((field) => [
            field.name,
            `https://storage.googleapis.com/inputs/${field.name}`
          ])
      )
      const expected = await prepareWorkflowRender(
        model,
        inputs,
        new AbortController().signal
      )
      let submitted: WorkflowRunRequest | undefined
      const id = 'bafc696e-e5d4-42f1-9a3d-d01f82a0629b'
      const statusUrl = `/v1/workshop/workflow-runs/${id}`
      const now = new Date().toISOString()
      const result: WorkflowRun = {
        run: {
          id,
          workflowId: model.workflowId,
          definitionVersion: model.workflow.definitionVersion,
          state: 'succeeded',
          outputState: 'failed',
          statusUrl,
          createdAt: now,
          updatedAt: now
        },
        outputs: [],
        runtime: { state: 'unknown' },
        retryOutputDeliveryUrl: `${statusUrl}/outputs/retry`
      }
      const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
        if (init?.method === 'POST') {
          submitted = JSON.parse(String(init.body))
          return Response.json(result.run, { status: 202 })
        }
        return Response.json(result)
      })
      const rendered = await workflow_render(model.slug, inputs, {
        token: 'test-key',
        fetch,
        idempotencyKey: 'same-attempt'
      })
      expect(submitted).toEqual(expected)
      expect(rendered.run.run.id).toBe(id)
      expect(rendered.outputs).toEqual([])
      expect(fetch).toHaveBeenCalledTimes(2)
    }
  )
})
