import { crc32, deflateSync } from 'node:zlib'
import { assert, describe, expect, it } from 'vitest'

import { createWorkflowBearingPng } from '@e2e/fixtures/data/agent/workflowBearingPng'
import { getWorkflowDataFromFile } from '@/scripts/metadata/parser'
import { deriveWorkflowFile } from './derivedWorkflowAttachment'

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
  assert.exists(derived)
  return JSON.parse(await derived.text())
}

describe('deriveWorkflowFile against a real PNG', () => {
  it.for([
    { name: 'portrait.png', type: 'image/png' },
    { name: 'portrait.webp', type: 'image/png' },
    { name: 'portrait.PNG', type: '' },
    { name: 'portrait.png', type: 'application/octet-stream' }
  ])(
    'lifts the workflow from $name with MIME "$type"',
    async ({ name, type }) => {
      const file = new File(
        [new Uint8Array(createWorkflowBearingPng({ workflow: WORKFLOW }))],
        name,
        { type }
      )

      expect(await parsedWorkflow(file)).toEqual(WORKFLOW)
    }
  )

  it('names the derived file after the image', async () => {
    const derived = await deriveWorkflowFile(
      pngFile(
        createWorkflowBearingPng({ workflow: WORKFLOW }),
        'holiday-snap.png'
      )
    )

    assert.exists(derived)
    expect(derived.name).toBe('holiday-snap.workflow.json')
    expect(derived.type).toBe('application/json')
  })

  it('prefers the editor workflow when the image carries both', async () => {
    const file = pngFile(
      createWorkflowBearingPng({ workflow: WORKFLOW, prompt: API_PROMPT })
    )

    expect(await parsedWorkflow(file)).toEqual(WORKFLOW)
  })

  it('preserves non-ASCII text in the lifted workflow', async () => {
    const translated = {
      nodes: [
        {
          id: 1,
          type: 'CLIPTextEncode',
          widgets_values: ['夕焼けの街、ネオン']
        }
      ]
    }
    const file = pngFile(createWorkflowBearingPng({ workflow: translated }))

    expect(await parsedWorkflow(file)).toEqual(translated)
  })

  it('rejects a complete PNG with a readable compressed workflow', async () => {
    const raw = JSON.stringify(WORKFLOW)
    const data = Buffer.concat([
      Buffer.from('workflow\0'),
      Buffer.from([1, 0, 0, 0]),
      deflateSync(raw)
    ])
    const chunk = Buffer.alloc(data.length + 12)
    chunk.writeUInt32BE(data.length)
    chunk.write('iTXt', 4)
    data.copy(chunk, 8)
    chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4)
    const base = createWorkflowBearingPng({})
    const file = pngFile(
      Buffer.concat([base.subarray(0, -12), chunk, base.subarray(-12)])
    )

    expect(await getWorkflowDataFromFile(file)).toEqual({ workflow: raw })
    await expect(deriveWorkflowFile(file)).resolves.toBeUndefined()
  })

  it('rejects a complete PNG carrying an oversized valid workflow', async () => {
    const workflow = {
      ...WORKFLOW,
      extra: { description: 'x'.repeat(10 * 1024 * 1024) }
    }
    const file = pngFile(createWorkflowBearingPng({ workflow }))

    expect(await getWorkflowDataFromFile(file)).toEqual({
      workflow: JSON.stringify(workflow)
    })
    await expect(deriveWorkflowFile(file)).resolves.toBeUndefined()
  })

  it('lifts nothing from a PNG with no ComfyUI metadata', async () => {
    const file = pngFile(createWorkflowBearingPng({}), 'plain.png')

    await expect(deriveWorkflowFile(file)).resolves.toBeUndefined()
  })

  it('lifts nothing from a PNG carrying only an API prompt', async () => {
    const promptOnly = createWorkflowBearingPng({ prompt: API_PROMPT })
    const file = pngFile(promptOnly, 'api-only.png')

    await expect(deriveWorkflowFile(file)).resolves.toBeUndefined()
  })
})
