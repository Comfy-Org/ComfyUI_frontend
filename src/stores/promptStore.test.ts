import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createPrompt,
  fetchPromptTemplate,
  fetchPrompts
} from '@/platform/prompts/services/promptService'
import type { Prompt } from '@/platform/prompts/schemas/promptTypes'
import { usePromptStore } from '@/stores/promptStore'

vi.mock('@/platform/prompts/services/promptService', () => ({
  fetchPrompts: vi.fn(),
  fetchPromptTemplate: vi.fn(),
  createPrompt: vi.fn()
}))

const mockedFetch = vi.mocked(fetchPrompts)
const mockedFetchTemplate = vi.mocked(fetchPromptTemplate)
const mockedCreate = vi.mocked(createPrompt)

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
})
