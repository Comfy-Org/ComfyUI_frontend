// @vitest-environment node
import { execFileSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'

import { prepareWorkflowRender } from './workflow-render'
import { workflowCloudRequest } from './workshop-workflow-api'
import { initialWorkshopPageState } from './workshop-page-state'
import { urlUploadField } from './workshop-playground'
import { workflowDetailsBySlug } from './workshop-workflow-content'
import {
  workflowCurl,
  workflowSnippetRequest
} from './workshop-workflow-snippet'

describe('workflow API snippets', () => {
  it.for([...workflowDetailsBySlug.values()])(
    'matches browser defaults for $slug',
    async (model) => {
      const initial = initialWorkshopPageState(model)
      const inputs = Object.fromEntries(
        initial.schema
          .filter(urlUploadField)
          .map((field) => [field.name, 'https://media.example/' + field.name])
      )
      const request = workflowSnippetRequest(model, inputs)
      const prepared = await prepareWorkflowRender(
        model,
        inputs,
        new AbortController().signal,
        async (source) =>
          'UPLOADED_' + new URL(String(source)).pathname.slice(1) + '_FILENAME'
      )
      expect(request).toEqual(workflowCloudRequest(model.workflow, prepared))
    }
  )

  it('quotes the exact Cloud request without executing prompt text', () => {
    const model = workflowDetailsBySlug.get('workflows/change-material')
    if (!model) throw new Error('Missing fixture')
    const request = workflowSnippetRequest(model, {
      prompt:
        "Keep 'single quotes', $(printf changed), `printf changed`, and\nnewlines."
    })
    const code = workflowCurl(request)
    const args = execFileSync(
      'sh',
      ['-c', `curl() { printf '%s\\n' "$@"; }\n${code}`],
      { encoding: 'utf8' }
    )
    expect(JSON.parse(args.split('--data\n')[1])).toEqual(request)
    expect(args).toContain('X-API-Key: YOUR_API_KEY\n')
    expect(args).toContain('/api/prompt')
    expect(args).not.toContain('base64')
  })
})
