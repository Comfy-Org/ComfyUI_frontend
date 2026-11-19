import { describe, expect, it } from 'vitest'

import {
  createPlainPng,
  createWorkflowBearingPng
} from '@e2e/fixtures/data/agent/workflowBearingPng'
import { deriveWorkflowFile } from './derivedWorkflowAttachment'

// The sibling suite mocks `getWorkflowDataFromFile` to pin this module's own
// branches. This one deliberately does not: it runs a real PNG through the real
// metadata parser, so the integration the feature actually depends on is proven
// rather than assumed from a mock's shape.

const WORKFLOW = {
  nodes: [
    { id: 41, type: 'KSampler', title: 'Embedded', pos: [10, 20] },
    { id: 42, type: 'SaveImage', pos: [300, 20] }
  ],
  links: [],
  version: 0.4
}

const API_PROMPT = { '1': { class_type: 'KSampler', inputs: {} } }

function pngFile(buffer: Buffer, name = 'portrait.png'): File {
  return new File([new Uint8Array(buffer)], name, { type: 'image/png' })
}

async function parsedWorkflow(file: File): Promise<unknown> {
  const derived = await deriveWorkflowFile(file)
  expect(derived).toBeInstanceOf(File)
  return JSON.parse(await derived!.text())
}

describe('deriveWorkflowFile against a real PNG', () => {
  it('lifts the workflow out of a tEXt chunk', async () => {
    const file = pngFile(createWorkflowBearingPng({ workflow: WORKFLOW }))

    expect(await parsedWorkflow(file)).toEqual(WORKFLOW)
  })

  it('names the derived file after the image', async () => {
    const derived = await deriveWorkflowFile(
      pngFile(
        createWorkflowBearingPng({ workflow: WORKFLOW }),
        'holiday-snap.png'
      )
    )

    expect(derived!.name).toBe('holiday-snap.workflow.json')
    expect(derived!.type).toBe('application/json')
  })

  it('prefers the editor workflow when the image carries both', async () => {
    // ComfyUI's SaveImage writes `workflow` and `prompt` together. The editor
    // graph is the one with layout, groups and reroutes, so it must win.
    const file = pngFile(
      createWorkflowBearingPng({ workflow: WORKFLOW, prompt: API_PROMPT })
    )

    expect(await parsedWorkflow(file)).toEqual(WORKFLOW)
  })

  it('lifts nothing from a PNG with no ComfyUI metadata', async () => {
    const file = pngFile(createPlainPng(), 'plain.png')

    await expect(deriveWorkflowFile(file)).resolves.toBeUndefined()
  })

  it('lifts nothing from a PNG carrying only an API prompt', async () => {
    // BE-4259 owns the lossy API-graph fallback; it must not happen here.
    const promptOnly = createWorkflowBearingPng({ prompt: API_PROMPT })
    const file = pngFile(promptOnly, 'api-only.png')

    await expect(deriveWorkflowFile(file)).resolves.toBeUndefined()
  })
})
