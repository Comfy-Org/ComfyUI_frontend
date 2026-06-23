import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createPrompt,
  deletePrompt,
  fetchPromptTemplate,
  fetchPrompts,
  renamePrompt
} from '@/platform/prompts/services/promptService'
import type { Prompt } from '@/platform/prompts/schemas/promptTypes'
import { usePromptStore } from '@/stores/promptStore'

vi.mock('@/platform/prompts/services/promptService', () => ({
  fetchPrompts: vi.fn(),
  fetchPromptTemplate: vi.fn(),
  createPrompt: vi.fn(),
  savePromptVersion: vi.fn(),
  deletePrompt: vi.fn(),
  renamePrompt: vi.fn(),
  fetchPromptVersions: vi.fn()
}))

const mockedFetch = vi.mocked(fetchPrompts)
const mockedFetchTemplate = vi.mocked(fetchPromptTemplate)
const mockedCreate = vi.mocked(createPrompt)
const mockedDelete = vi.mocked(deletePrompt)
const mockedRename = vi.mocked(renamePrompt)

const prompt = (
  id: string,
  name: string,
  template: Prompt['template'] = []
): Prompt => ({
  id,
  name,
  template
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('usePromptStore', () => {
  it('loads prompts into the cache', async () => {
    mockedFetch.mockResolvedValue([prompt('1', 'one'), prompt('2', 'two')])
    const store = usePromptStore()

    await store.loadPrompts()

    expect(store.hasLoaded).toBe(true)
    expect(store.prompts.map((p) => p.id)).toEqual(['1', '2'])
  })

  it('lazily resolves a template from file content and caches it', async () => {
    mockedFetch.mockResolvedValue([prompt('1', 'one')])
    mockedFetchTemplate.mockResolvedValue([{ type: 'text', value: 'loaded' }])
    const store = usePromptStore()
    await store.loadPrompts()

    const template = await store.resolveTemplate('1')

    expect(template).toEqual([{ type: 'text', value: 'loaded' }])
    expect(store.getPrompt('1')?.template).toEqual([
      { type: 'text', value: 'loaded' }
    ])
  })

  it('returns a cached template without refetching', async () => {
    mockedFetch.mockResolvedValue([
      prompt('1', 'one', [{ type: 'text', value: 'cached' }])
    ])
    const store = usePromptStore()
    await store.loadPrompts()

    const template = await store.resolveTemplate('1')

    expect(template).toEqual([{ type: 'text', value: 'cached' }])
    expect(mockedFetchTemplate).not.toHaveBeenCalled()
  })

  it('adds a saved prompt to the cache', async () => {
    const saved = prompt('3', 'three', [{ type: 'text', value: 'three' }])
    mockedCreate.mockResolvedValue(saved)
    const store = usePromptStore()

    const result = await store.savePrompt({
      name: 'three',
      template: saved.template
    })

    expect(result).toEqual(saved)
    expect(store.getPrompt('3')).toEqual(saved)
  })

  it('removes a prompt from the cache on delete', async () => {
    mockedFetch.mockResolvedValue([prompt('1', 'one'), prompt('2', 'two')])
    mockedDelete.mockResolvedValue()
    const store = usePromptStore()
    await store.loadPrompts()

    await store.deletePrompt('1')

    expect(mockedDelete).toHaveBeenCalledWith('1')
    expect(store.prompts.map((p) => p.id)).toEqual(['2'])
  })

  it('updates the cached name on rename', async () => {
    mockedFetch.mockResolvedValue([prompt('1', 'one')])
    mockedRename.mockResolvedValue()
    const store = usePromptStore()
    await store.loadPrompts()

    await store.renamePrompt('1', 'renamed')

    expect(mockedRename).toHaveBeenCalledWith('1', '1', 'renamed')
    expect(store.getPrompt('1')?.name).toBe('renamed')
  })
})
