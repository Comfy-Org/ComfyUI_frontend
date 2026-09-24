import { describe, expect, it } from 'vitest'

import { SNIPPET_LANGUAGES } from './models-snippets'
import type { WorkflowField } from './workflow-fields'
import type { SnippetWorkflow } from './workflow-snippets'
import {
  WORKFLOW_API_BASE,
  buildWorkflowSnippet,
  workflowInputs
} from './workflow-snippets'

const fields: readonly WorkflowField[] = [
  { node: '1', input: 'image', label: 'Your image', kind: 'image' },
  { node: '2', input: 'prompt', label: 'What to change', kind: 'text' },
  { node: '3', input: 'steps', label: 'Steps', kind: 'number' }
]

const graph = {
  '1': { class_type: 'LoadImage', inputs: { image: 'inputs/example.png' } },
  '2': { class_type: 'Text', inputs: { prompt: 'make it night' } },
  '3': { class_type: 'K', inputs: { steps: 20 } }
}

const workflow = (ownDeployment = false): SnippetWorkflow => ({
  fields,
  slug: 'poster',
  ownDeployment
})

describe('workflowInputs', () => {
  // A snippet tells the reader which file to put beside their script, and a
  // path from the template is not that file.
  it('names the file to put beside the script, not the path it came from', () => {
    const [image, prompt, steps] = workflowInputs(workflow(), graph)

    expect(image.filename).toBe('example.png')
    expect(prompt.filename).toBeUndefined()
    expect(prompt.value).toBe('make it night')
    expect(steps.value).toBe(20)
  })

  it('carries what the form holds now over the template default', () => {
    const [, prompt] = workflowInputs(workflow(), graph, {
      '2.prompt': 'make it snow'
    })

    expect(prompt.value).toBe('make it snow')
  })
})

describe('buildWorkflowSnippet', () => {
  it.for(SNIPPET_LANGUAGES)('binds every answer in %s', (language) => {
    const snippet = buildWorkflowSnippet(language, workflow(), graph)

    for (const field of fields) expect(snippet).toContain(field.input)
    expect(snippet).toContain('poster.api.json')
  })

  // Cloud is ours to name. A deployment of the reader's own is not, so the
  // snippet reads its address from their environment instead.
  it.for(SNIPPET_LANGUAGES)(
    'names Cloud in %s when Cloud runs it',
    (language) => {
      expect(buildWorkflowSnippet(language, workflow(), graph)).toContain(
        WORKFLOW_API_BASE
      )
    }
  )

  it.for(SNIPPET_LANGUAGES)(
    'asks for their own address in %s instead',
    (language) => {
      const snippet = buildWorkflowSnippet(language, workflow(true), graph)

      expect(snippet).toContain('COMFY_BASE_URL')
      expect(snippet).not.toContain(WORKFLOW_API_BASE)
    }
  )
})
