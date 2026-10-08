import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

import {
  EXPECTED_PROMPT,
  EXPECTED_PROMPT_NAN_COERCED,
  EXPECTED_WORKFLOW,
  mockFileReaderAbort,
  mockFileReaderError
} from './__fixtures__/helpers'
import { getFromWebmFile } from './ebml'

const fixturePath = path.resolve(__dirname, '__fixtures__/with_metadata.webm')
const nanFixturePath = path.resolve(
  __dirname,
  '__fixtures__/with_nan_metadata.webm'
)

function encodeEbmlElement(id: number[], data: Uint8Array): Uint8Array {
  return new Uint8Array([
    ...id,
    0x40 | (data.length >> 8),
    data.length & 0xff,
    ...data
  ])
}

function createWebmWithTags(metadata: Record<string, string>): File {
  const encoder = new TextEncoder()
  const tags = Object.entries(metadata).flatMap(([name, value]) => {
    const tagName = encodeEbmlElement([0x45, 0xa3], encoder.encode(name))
    const tagValue = encodeEbmlElement([0x44, 0x87], encoder.encode(value))
    return Array.from(
      encodeEbmlElement([0x67, 0xc8], new Uint8Array([...tagName, ...tagValue]))
    )
  })
  return new File(
    [new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, ...tags])],
    'metadata.webm',
    { type: 'video/webm' }
  )
}

describe('WebM/EBML metadata', () => {
  it('extracts workflow and prompt from EBML SimpleTag elements', async () => {
    const bytes = fs.readFileSync(fixturePath)
    const file = new File([bytes], 'test.webm', { type: 'video/webm' })

    const result = await getFromWebmFile(file)

    expect(result.workflow).toEqual(EXPECTED_WORKFLOW)
    expect(result.prompt).toEqual(EXPECTED_PROMPT)
  })

  it.for([
    { name: 'an opening brace', text: 'draw a literal { on screen' },
    { name: 'a closing brace', text: 'draw a literal } on screen' },
    { name: 'reversed braces', text: '} before {' },
    { name: 'an escaped quote', text: 'draw " followed by {' },
    { name: 'a trailing backslash', text: 'C:\\renders\\' },
    { name: 'a backslash and quote', text: 'draw \\" followed by }' }
  ])('preserves workflow strings containing $name', async ({ text }) => {
    const workflow = {
      nodes: [{ id: 1, type: 'Note', widgets_values: [text] }]
    }
    const file = createWebmWithTags({ WORKFLOW: JSON.stringify(workflow) })

    const result = await getFromWebmFile(file)

    expect(result.workflow).toEqual(workflow)
  })

  it('preserves prompt strings when coercing non-finite numeric values', async () => {
    const file = createWebmWithTags({
      PROMPT:
        '{"1":{"class_type":"CLIPTextEncode","inputs":{"text":"a }","weight":NaN}}}'
    })

    const result = await getFromWebmFile(file)

    expect(result.prompt).toEqual({
      '1': {
        class_type: 'CLIPTextEncode',
        inputs: { text: 'a }', weight: null }
      }
    })
  })

  it('extracts nested workflows and prompts from separate tags', async () => {
    const workflow = {
      nodes: [
        { id: 1, type: 'Note', widgets_values: ['opening {'] },
        { id: 2, type: 'Note', widgets_values: ['closing }'] }
      ],
      extra: { notes: [{ text: 'a "quote" and }' }] }
    }
    const prompt = {
      '3': {
        class_type: 'CLIPTextEncode',
        inputs: { text: 'literal }', clip: ['4', 0] }
      }
    }
    const file = createWebmWithTags({
      WORKFLOW: JSON.stringify(workflow),
      PROMPT: JSON.stringify(prompt)
    })

    const result = await getFromWebmFile(file)

    expect(result).toEqual({ workflow, prompt })
  })

  it.for([
    { name: 'an unclosed object', text: '{"nodes":[]' },
    { name: 'an unclosed string', text: '{"nodes":["unfinished }' },
    { name: 'invalid JSON', text: '{"nodes":[invalid]}' }
  ])('ignores metadata containing $name', async ({ text }) => {
    const file = createWebmWithTags({ WORKFLOW: text })

    const result = await getFromWebmFile(file)

    expect(result.workflow).toBeUndefined()
  })

  it('parses Python generated prompt with bare NaN/Infinity tokens', async () => {
    const bytes = fs.readFileSync(nanFixturePath)
    const file = new File([bytes], 'nan.webm', { type: 'video/webm' })

    const result = await getFromWebmFile(file)

    expect(result.workflow).toBeUndefined()
    expect(result.prompt).toEqual(EXPECTED_PROMPT_NAN_COERCED)
  })

  it('returns empty for non-WebM data', async () => {
    const file = new File([new Uint8Array(16)], 'fake.webm')

    const result = await getFromWebmFile(file)

    expect(result).toEqual({})
  })

  describe('FileReader failure modes', () => {
    const file = new File([new Uint8Array(16)], 'test.webm')

    it('resolves empty when the FileReader fires error', async () => {
      mockFileReaderError('readAsArrayBuffer')
      expect(await getFromWebmFile(file)).toEqual({})
    })

    it('resolves empty when the FileReader fires abort', async () => {
      mockFileReaderAbort('readAsArrayBuffer')
      expect(await getFromWebmFile(file)).toEqual({})
    })
  })
})
