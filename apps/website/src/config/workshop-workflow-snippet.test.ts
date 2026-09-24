// @vitest-environment node
import { execFileSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'

import { prepareWorkflowRender } from './workflow-render'
import { workflowDetailsBySlug } from './workshop-workflow-content'
import {
  workflowCurl,
  workflowSnippetRequest
} from './workshop-workflow-snippet'

describe('workflow API snippets', () => {
  it.for([...workflowDetailsBySlug.values()])(
    'matches browser defaults for $slug',
    async (model) => {
      const request = workflowSnippetRequest(model, {})
      const prepared = await prepareWorkflowRender(
        model,
        request.appInputs,
        new AbortController().signal
      )
      expect(request).toEqual(prepared)
      expect(Object.keys(request.appInputs)).toEqual(
        Object.keys(model.workflow.inputs)
      )
    }
  )

  it('quotes the exact request and idempotency key without executing prompt text', () => {
    const model = workflowDetailsBySlug.get('workflows/change-material')
    if (!model) throw new Error('Missing fixture')
    const request = workflowSnippetRequest(model, {
      prompt:
        "Keep 'single quotes', $(printf changed), `printf changed`, and\nnewlines."
    })
    const key = 'a51d2d84-8dc1-4649-bc0f-44b7d51ab320'
    const code = workflowCurl(request, key)
    const args = execFileSync(
      'sh',
      ['-c', `curl() { printf '%s\\n' "$@"; }\n${code}`],
      { encoding: 'utf8' }
    )
    expect(JSON.parse(args.split('--data\n')[1])).toEqual(request)
    expect(args).toContain(`Idempotency-Key: ${key}\n`)
    expect(args).not.toContain('base64')
  })
})
