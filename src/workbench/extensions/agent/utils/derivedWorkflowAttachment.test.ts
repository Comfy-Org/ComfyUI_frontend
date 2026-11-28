import { crc32, deflateSync } from 'node:zlib'
import { assert, describe, expect, it, vi } from 'vitest'

import { createWorkflowBearingPng } from '@e2e/fixtures/data/agent/workflowBearingPng'
import { getWorkflowDataFromFile } from '@/scripts/metadata/parser'
import {
  deriveWorkflowFile,
  derivedWorkflowName
} from './derivedWorkflowAttachment'

vi.mock(import('@/scripts/metadata/parser'))

const mockParser = vi.mocked(getWorkflowDataFromFile)

const WORKFLOW = {
  nodes: [{ id: 1, type: 'KSampler', pos: [100, 100], size: [200, 200] }]
}

function imageFile(name = 'photo.png') {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' })
}

async function workflowIn(file: File): Promise<unknown> {
  return JSON.parse(await file.text())
}

describe('derivedWorkflowName', () => {
  it('replaces the source extension', () => {
    expect(derivedWorkflowName('photo.png')).toBe('photo.workflow.json')
    expect(derivedWorkflowName('clip.final.webp')).toBe(
      'clip.final.workflow.json'
    )
  })

  it('keeps an extensionless name', () => {
    expect(derivedWorkflowName('photo')).toBe('photo.workflow.json')
  })

  it('never reduces a dotfile to an empty name', () => {
    expect(derivedWorkflowName('.png')).toBe('.png.workflow.json')
  })
})

describe('deriveWorkflowFile', () => {
  it('lifts a workflow handed back as a JSON string', async () => {
    mockParser.mockResolvedValue({ workflow: JSON.stringify(WORKFLOW) })

    const derived = await deriveWorkflowFile(imageFile())

    assert.exists(derived)
    expect(derived.name).toBe('photo.workflow.json')
    expect(derived.type).toBe('application/json')
    expect(await workflowIn(derived)).toEqual(WORKFLOW)
  })

  it('lifts a workflow handed back as an object', async () => {
    mockParser.mockResolvedValue({ workflow: WORKFLOW })

    const derived = await deriveWorkflowFile(imageFile())

    assert.exists(derived)
    expect(await workflowIn(derived)).toEqual(WORKFLOW)
  })

  it('tolerates bare NaN and Infinity tokens', async () => {
    mockParser.mockResolvedValue({
      workflow:
        '{"nodes":[{"id":1,"type":"KSampler","widgets_values":[NaN,Infinity]}]}'
    })

    const derived = await deriveWorkflowFile(imageFile())

    assert.exists(derived)
    expect(await workflowIn(derived)).toEqual({
      nodes: [{ id: 1, type: 'KSampler', widgets_values: [null, null] }]
    })
  })

  it('returns nothing when the image carries no metadata', async () => {
    mockParser.mockResolvedValue(undefined)
    await expect(deriveWorkflowFile(imageFile())).resolves.toBeUndefined()
  })

  it('returns nothing for an API-format prompt with no editor graph', async () => {
    mockParser.mockResolvedValue({
      prompt: { '1': { class_type: 'KSampler', inputs: {} } }
    })

    await expect(deriveWorkflowFile(imageFile())).resolves.toBeUndefined()
  })

  it('returns nothing for a graph with no nodes', async () => {
    mockParser.mockResolvedValue({ workflow: '{"nodes":[]}' })
    await expect(deriveWorkflowFile(imageFile())).resolves.toBeUndefined()
  })

  it('returns nothing for an empty workflow value', async () => {
    mockParser.mockResolvedValue({ workflow: '' })
    await expect(deriveWorkflowFile(imageFile())).resolves.toBeUndefined()
  })

  it('returns nothing for unparseable workflow text', async () => {
    mockParser.mockResolvedValue({ workflow: '{"nodes":[' })
    await expect(deriveWorkflowFile(imageFile())).resolves.toBeUndefined()
  })

  it('rejects oversized workflow text before parsing it', async () => {
    mockParser.mockResolvedValue({
      workflow: JSON.stringify({
        ...WORKFLOW,
        extra: { description: 'x'.repeat(10 * 1024 * 1024) }
      })
    })

    await expect(deriveWorkflowFile(imageFile())).resolves.toBeUndefined()
  })

  it('never lets a parser failure block the image', async () => {
    mockParser.mockRejectedValue(new Error('unreadable container'))
    await expect(deriveWorkflowFile(imageFile())).resolves.toBeUndefined()
  })

  it('rejects compressed PNG text before invoking the shared parser', async () => {
    mockParser.mockResolvedValue({ workflow: WORKFLOW })
    const data = Buffer.concat([
      Buffer.from('workflow\0'),
      Buffer.from([1, 0, 0, 0]),
      deflateSync(JSON.stringify(WORKFLOW))
    ])
    const chunk = Buffer.alloc(12 + data.length)
    chunk.writeUInt32BE(data.length)
    chunk.write('iTXt', 4)
    data.copy(chunk, 8)
    chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4)
    const base = createWorkflowBearingPng({})
    const png = Buffer.concat([
      base.subarray(0, -12),
      chunk,
      base.subarray(-12)
    ])
    const file = new File([new Uint8Array(png)], 'compressed.png', {
      type: 'image/png'
    })

    await expect(deriveWorkflowFile(file)).resolves.toBeUndefined()
    expect(mockParser).not.toHaveBeenCalled()
  })

  it("rejects oversized PNG text when the signature matches the shared reader's 4-byte magic gate but not our full 8-byte signature", async () => {
    mockParser.mockResolvedValue({ workflow: WORKFLOW })
    const png = createWorkflowBearingPng({
      workflow: {
        ...WORKFLOW,
        extra: { description: 'x'.repeat(10 * 1024 * 1024) }
      }
    })
    png[7] = 0
    const file = new File([new Uint8Array(png)], 'odd-signature.png', {
      type: 'image/png'
    })

    await expect(deriveWorkflowFile(file)).resolves.toBeUndefined()
    expect(mockParser).not.toHaveBeenCalled()
  })

  it.for([
    { name: 'graph.json', type: 'application/json' },
    { name: 'clip.mp4', type: 'video/mp4' },
    { name: 'clip.png', type: 'video/mp4' },
    { name: 'sound.png', type: 'audio/mpeg' }
  ])(
    'excludes $name with MIME $type despite valid metadata',
    async ({ name, type }) => {
      mockParser.mockResolvedValue({ workflow: JSON.stringify(WORKFLOW) })
      const file = new File(['{}'], name, { type })

      await expect(deriveWorkflowFile(file)).resolves.toBeUndefined()
    }
  )
})
