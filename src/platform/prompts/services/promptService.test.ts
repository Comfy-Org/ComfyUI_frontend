import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import {
  createPrompt,
  fetchPromptTemplate,
  fetchPrompts
} from '@/platform/prompts/services/promptService'

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    getAllAssetsByTag: vi.fn(),
    uploadAssetFromBase64: vi.fn(),
    addAssetTags: vi.fn(),
    getAssetContent: vi.fn()
  }
}))

vi.mock('@/platform/distribution/types', () => ({ isCloud: false }))

const mockedAssetService = vi.mocked(assetService)

function asset(overrides: Partial<AssetItem>): AssetItem {
  return {
    id: 'id',
    name: 'name.txt',
    tags: ['prompt'],
    metadata: {},
    user_metadata: {},
    ...overrides
  } as AssetItem
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchPrompts', () => {
  it('maps prompt assets and prefers the metadata name', async () => {
    mockedAssetService.getAllAssetsByTag.mockResolvedValue([
      asset({
        id: 'a',
        name: 'a.txt',
        user_metadata: {
          name: 'Greeting',
          template: [{ type: 'text', value: 'hi' }],
          description: 'a friendly hello'
        }
      })
    ])

    const prompts = await fetchPrompts()

    expect(mockedAssetService.getAllAssetsByTag).toHaveBeenCalledWith('prompt')
    expect(prompts).toEqual([
      {
        id: 'a',
        name: 'Greeting',
        template: [{ type: 'text', value: 'hi' }],
        description: 'a friendly hello'
      }
    ])
  })

  it('derives the name from the filename when metadata is absent', async () => {
    mockedAssetService.getAllAssetsByTag.mockResolvedValue([
      asset({ id: 'b', name: 'Editorial menswear.txt', user_metadata: {} })
    ])

    const [prompt] = await fetchPrompts()

    expect(prompt).toEqual({
      id: 'b',
      name: 'Editorial menswear',
      template: [],
      description: undefined
    })
  })

  it('parses metadata returned as a JSON string', async () => {
    mockedAssetService.getAllAssetsByTag.mockResolvedValue([
      asset({
        id: 'c',
        name: 'c.txt',
        user_metadata: JSON.stringify({
          name: 'Encoded',
          template: [{ type: 'text', value: 'hi' }]
        }) as unknown as Record<string, unknown>
      })
    ])

    const [prompt] = await fetchPrompts()

    expect(prompt.name).toBe('Encoded')
    expect(prompt.template).toEqual([{ type: 'text', value: 'hi' }])
  })
})

describe('fetchPromptTemplate', () => {
  it('reads the template from JSON file content', async () => {
    mockedAssetService.getAssetContent.mockResolvedValue(
      JSON.stringify({ name: 'p', template: [{ type: 'text', value: 'hi' }] })
    )

    expect(await fetchPromptTemplate('id')).toEqual([
      { type: 'text', value: 'hi' }
    ])
  })

  it('treats non-JSON content as plain text (legacy prompts)', async () => {
    mockedAssetService.getAssetContent.mockResolvedValue('just some text')

    expect(await fetchPromptTemplate('id')).toEqual([
      { type: 'text', value: 'just some text' }
    ])
  })
})

describe('createPrompt', () => {
  it('stores the template as JSON file content tagged prompt', async () => {
    const template = [
      { type: 'text', value: 'a portrait in ' },
      { type: 'asset', id: 'p1', name: 'style' }
    ] as const
    mockedAssetService.uploadAssetFromBase64.mockResolvedValue({
      ...asset({ id: 'x', name: 'My Prompt.txt', tags: ['prompt'] }),
      created_new: true
    })

    const result = await createPrompt({
      name: 'My Prompt',
      template: [...template]
    })

    const payload = mockedAssetService.uploadAssetFromBase64.mock.calls[0][0]
    expect(payload.name).toBe('My Prompt.txt')
    expect(payload.tags).toEqual(['input', 'prompt'])
    const stored = JSON.parse(decodeURIComponent(payload.data.split(',')[1]))
    expect(stored).toMatchObject({ name: 'My Prompt', template: [...template] })

    expect(result).toEqual({
      id: 'x',
      name: 'My Prompt',
      template: [...template],
      description: undefined
    })
  })

  it('ensures the prompt tag when the upload did not apply it', async () => {
    mockedAssetService.uploadAssetFromBase64.mockResolvedValue({
      ...asset({ id: 'y', name: 'y.txt', tags: [] }),
      created_new: true
    })

    await createPrompt({ name: 'y', template: [{ type: 'text', value: 'x' }] })

    expect(mockedAssetService.addAssetTags).toHaveBeenCalledWith('y', [
      'prompt'
    ])
  })
})
