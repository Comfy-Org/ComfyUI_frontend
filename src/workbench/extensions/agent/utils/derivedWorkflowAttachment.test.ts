import { assert, describe, expect, it, vi } from 'vitest'

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
    mockParser.mockResolvedValue({ workflow: ' '.repeat(10 * 1024 * 1024 + 1) })

    await expect(deriveWorkflowFile(imageFile())).resolves.toBeUndefined()
  })

  it('never lets a parser failure block the image', async () => {
    mockParser.mockRejectedValue(new Error('unreadable container'))
    await expect(deriveWorkflowFile(imageFile())).resolves.toBeUndefined()
  })

  it('rejects compressed PNG text before invoking the shared parser', async () => {
    const signature = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
    ])
    const data = new Uint8Array([
      ...new TextEncoder().encode('workflow'),
      0,
      1,
      0,
      0,
      0,
      1
    ])
    const chunk = new Uint8Array(12 + data.length)
    new DataView(chunk.buffer).setUint32(0, data.length)
    chunk.set(new TextEncoder().encode('iTXt'), 4)
    chunk.set(data, 8)
    const file = new File([signature, chunk], 'compressed.png', {
      type: 'image/png'
    })

    await expect(deriveWorkflowFile(file)).resolves.toBeUndefined()
    expect(mockParser).not.toHaveBeenCalled()
  })

  it('rejects oversized PNG text even when only the 4-byte magic matches', async () => {
    // The shared reader (getFromPngBuffer) gates on the 4-byte PNG magic alone,
    // not the full 8-byte signature. A file that fails our 8-byte check but
    // passes that 4-byte gate must still go through the bound-checking walk,
    // or the shared reader would process its metadata unbounded.
    const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])
    const data = new Uint8Array(10 * 1024 * 1024 + 1)
    const chunk = new Uint8Array(12 + data.length)
    new DataView(chunk.buffer).setUint32(0, data.length)
    chunk.set(new TextEncoder().encode('tEXt'), 4)
    chunk.set(data, 8)
    const file = new File([signature, chunk], 'odd-signature.png', {
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
