// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { workflowDetailsBySlug } from '@/config/workshop-workflow-content'
import { initialWorkshopPageState } from '@/config/workshop-page-state'
import { urlUploadField } from '@/config/workshop-playground'
import { prepareWorkflowRender } from '@/config/workflow-render'
import { workflowCloudRequest } from '@/config/workshop-workflow-api'
import { workflow_for_model, workflow_render } from './workflow-render'

describe('CLI workflow rendering', () => {
  it.for([...workflowDetailsBySlug.values()])(
    'uses the browser defaults and request contract for $slug',
    async (model) => {
      const initial = initialWorkshopPageState(model)
      expect(workflow_for_model(model.slug)).toEqual(initial.values)
      // An empty `randomize` input (the seed) is drawn per run, so pin it to
      // compare the CLI submission with the browser's prepared request.
      const inputs = Object.fromEntries([
        ...initial.schema
          .filter((field) => urlUploadField(field))
          .map((field) => [
            field.name,
            `https://storage.googleapis.com/inputs/${field.name}`
          ]),
        ...Object.entries(model.workflow.inputs)
          .filter(([, input]) => input.randomize)
          .map(([name]) => [name, 7])
      ])
      const expected = await prepareWorkflowRender(
        model,
        inputs,
        new AbortController().signal,
        async () => 'uploaded-image.png'
      )
      let submitted: unknown
      const id = 'bafc696e-e5d4-42f1-9a3d-d01f82a0629b'
      const result = {
        id,
        status: 'completed',
        create_time: Date.now(),
        update_time: Date.now(),
        outputs: {}
      }
      const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
        if (init?.method === 'POST') {
          submitted = JSON.parse(String(init.body))
          return Response.json({ prompt_id: id })
        }
        return Response.json(result)
      })
      const rendered = await workflow_render(model.slug, inputs, {
        token: 'test-key',
        fetch,
        uploadFile: async () => 'uploaded-image.png'
      })
      expect(submitted).toEqual({
        ...workflowCloudRequest(model.workflow, expected),
        extra_data: { api_key_comfy_org: 'test-key' }
      })
      expect(rendered.run.run.id).toBe(id)
      expect(rendered.outputs).toEqual([])
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(
        new Headers(fetch.mock.calls[0][1]?.headers).get('X-API-Key')
      ).toBe('test-key')
    }
  )
})
