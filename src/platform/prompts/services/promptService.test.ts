import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import {
  createPrompt,
  deletePrompt,
  fetchPromptTemplate,
  fetchPromptVersions,
  fetchPrompts,
  renamePrompt,
  savePromptVersion
} from '@/platform/prompts/services/promptService'

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    getAllAssetsByTag: vi.fn(),
    uploadAssetFromBase64: vi.fn(),
    addAssetTags: vi.fn(),
    getAssetContent: vi.fn(),
    deleteAsset: vi.fn(),
    updateAsset: vi.fn()
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
        description: 'a friendly hello',
        latestAssetId: 'a'
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
      description: undefined,
      latestAssetId: 'b'
    })
  })

  it('collapses versions to the newest asset per prompt id', async () => {
    mockedAssetService.getAllAssetsByTag.mockResolvedValue([
      asset({
        id: 'v1',
        created_at: '2026-01-01T00:00:00Z',
        user_metadata: { name: 'Old', prompt_id: 'p' }
      }),
      asset({
        id: 'v2',
        created_at: '2026-02-01T00:00:00Z',
        user_metadata: { name: 'New', prompt_id: 'p' }
      })
    ])

    const prompts = await fetchPrompts()

    expect(prompts).toEqual([
      {
        id: 'p',
        name: 'New',
        template: [],
        description: undefined,
        latestAssetId: 'v2'
      }
    ])
  })

  it('groups versions by the prompt-id tag when user_metadata is absent', async () => {
    mockedAssetService.getAllAssetsByTag.mockResolvedValue([
      asset({
        id: 'v1',
        created_at: '2026-01-01T00:00:00Z',
        tags: ['input', 'prompt', 'prompt-id:p'],
        user_metadata: {}
      }),
      asset({
        id: 'v2',
        created_at: '2026-02-01T00:00:00Z',
        tags: ['input', 'prompt', 'prompt-id:p'],
        user_metadata: {}
      })
    ])

    const prompts = await fetchPrompts()

    expect(prompts).toHaveLength(1)
    expect(prompts[0]).toMatchObject({ id: 'p', latestAssetId: 'v2' })
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
    expect(payload.tags).toEqual(['input', 'prompt', `prompt-id:${result.id}`])
    expect(payload.user_metadata).toEqual({
      name: 'My Prompt',
      prompt_id: result.id
    })
    const stored = JSON.parse(decodeURIComponent(payload.data.split(',')[1]))
    expect(stored).toMatchObject({ name: 'My Prompt', template: [...template] })

    expect(result).toMatchObject({
      name: 'My Prompt',
      template: [...template],
      description: undefined,
      latestAssetId: 'x'
    })
    expect(typeof result.id).toBe('string')
  })

  it('ensures the prompt and id tags when the upload did not apply them', async () => {
    mockedAssetService.uploadAssetFromBase64.mockResolvedValue({
      ...asset({ id: 'y', name: 'y.txt', tags: [] }),
      created_new: true
    })

    const result = await createPrompt({
      name: 'y',
      template: [{ type: 'text', value: 'x' }]
    })

    expect(mockedAssetService.addAssetTags).toHaveBeenCalledWith('y', [
      'prompt',
      `prompt-id:${result.id}`
    ])
  })
})

describe('savePromptVersion', () => {
  it('uploads a new version under the given prompt id', async () => {
    mockedAssetService.uploadAssetFromBase64.mockResolvedValue({
      ...asset({ id: 'v2', tags: ['prompt'] }),
      created_new: true
    })

    const result = await savePromptVersion('p', {
      name: 'Edited',
      template: [{ type: 'text', value: 'edited' }]
    })

    const payload = mockedAssetService.uploadAssetFromBase64.mock.calls[0][0]
    expect(payload.user_metadata).toEqual({ name: 'Edited', prompt_id: 'p' })
    expect(result).toMatchObject({ id: 'p', latestAssetId: 'v2' })
  })
})

describe('deletePrompt', () => {
  it('deletes every version sharing the prompt id', async () => {
    mockedAssetService.getAllAssetsByTag.mockResolvedValue([
      asset({ id: 'v1', user_metadata: { prompt_id: 'p' } }),
      asset({ id: 'v2', user_metadata: { prompt_id: 'p' } }),
      asset({ id: 'other', user_metadata: { prompt_id: 'q' } })
    ])

    await deletePrompt('p')

    expect(mockedAssetService.deleteAsset).toHaveBeenCalledWith('v1')
    expect(mockedAssetService.deleteAsset).toHaveBeenCalledWith('v2')
    expect(mockedAssetService.deleteAsset).not.toHaveBeenCalledWith('other')
  })
})

describe('renamePrompt', () => {
  it('renames the latest version asset and preserves the prompt id', async () => {
    await renamePrompt('p', 'asset-x', 'New Name')
    expect(mockedAssetService.updateAsset).toHaveBeenCalledWith('asset-x', {
      name: 'New Name.txt',
      user_metadata: { name: 'New Name', prompt_id: 'p' }
    })
  })
})

describe('fetchPromptVersions', () => {
  it('lists versions for a prompt id, newest first', async () => {
    mockedAssetService.getAllAssetsByTag.mockResolvedValue([
      asset({
        id: 'v1',
        created_at: '2026-01-01T00:00:00Z',
        user_metadata: { name: 'Old', prompt_id: 'p' }
      }),
      asset({
        id: 'v2',
        created_at: '2026-02-01T00:00:00Z',
        user_metadata: { name: 'New', prompt_id: 'p' }
      }),
      asset({ id: 'other', user_metadata: { prompt_id: 'q' } })
    ])

    const versions = await fetchPromptVersions('p')

    expect(versions).toEqual([
      { assetId: 'v2', name: 'New', createdAt: '2026-02-01T00:00:00Z' },
      { assetId: 'v1', name: 'Old', createdAt: '2026-01-01T00:00:00Z' }
    ])
  })
})
