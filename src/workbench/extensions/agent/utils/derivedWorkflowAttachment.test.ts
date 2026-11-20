import { describe, expect, it, vi } from 'vitest'

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

    expect(derived).toBeInstanceOf(File)
    expect(derived!.name).toBe('photo.workflow.json')
    expect(derived!.type).toBe('application/json')
    expect(await workflowIn(derived!)).toEqual(WORKFLOW)
  })

  it('lifts a workflow handed back as an object', async () => {
    mockParser.mockResolvedValue({ workflow: WORKFLOW })

    const derived = await deriveWorkflowFile(imageFile())

    expect(await workflowIn(derived!)).toEqual(WORKFLOW)
  })

  it('tolerates bare NaN and Infinity tokens', async () => {
    mockParser.mockResolvedValue({
      workflow:
        '{"nodes":[{"id":1,"type":"KSampler","widgets_values":[NaN,Infinity]}]}'
    })

    const derived = await deriveWorkflowFile(imageFile())

    expect(derived).toBeDefined()
    const parsed = (await workflowIn(derived!)) as {
      nodes: Array<{ widgets_values: unknown }>
    }
    expect(parsed.nodes[0].widgets_values).toEqual([null, null])
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

  it('never lets a parser failure block the image', async () => {
    mockParser.mockRejectedValue(new Error('unreadable container'))
    await expect(deriveWorkflowFile(imageFile())).resolves.toBeUndefined()
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

  it('skips its own output, so derivation cannot recurse', async () => {
    mockParser.mockResolvedValue({ workflow: JSON.stringify(WORKFLOW) })
    const derived = await deriveWorkflowFile(imageFile())

    await expect(deriveWorkflowFile(derived!)).resolves.toBeUndefined()
  })
})
