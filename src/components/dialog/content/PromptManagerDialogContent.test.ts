import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PromptManagerDialogContent from '@/components/dialog/content/PromptManagerDialogContent.vue'
import {
  deletePrompt,
  fetchPromptTemplate,
  fetchPrompts,
  renamePrompt
} from '@/platform/prompts/services/promptService'
import type { Prompt } from '@/platform/prompts/schemas/promptTypes'

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
const mockedDelete = vi.mocked(deletePrompt)
const mockedRename = vi.mocked(renamePrompt)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { delete: 'Delete', cancel: 'Cancel' },
      promptNode: {
        searchPlaceholder: 'Search prompts',
        namePlaceholder: 'Prompt name',
        managerEmpty: 'No saved prompts yet',
        managerNoMatches: 'No prompts match your search',
        managerSelectHint: 'Select a prompt to view its contents',
        confirmDelete: 'Confirm delete'
      }
    }
  }
})

function renderDialog() {
  return render(PromptManagerDialogContent, { global: { plugins: [i18n] } })
}

const prompt = (id: string, name: string): Prompt => ({
  id,
  name,
  template: []
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  mockedFetch.mockResolvedValue([])
})

describe('PromptManagerDialogContent', () => {
  it('lists saved prompts', async () => {
    mockedFetch.mockResolvedValue([prompt('1', 'Alpha'), prompt('2', 'Beta')])
    renderDialog()
    expect(await screen.findByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('filters the list by search', async () => {
    mockedFetch.mockResolvedValue([prompt('1', 'Alpha'), prompt('2', 'Beta')])
    renderDialog()
    await screen.findByText('Alpha')

    await userEvent.type(screen.getByPlaceholderText('Search prompts'), 'bet')

    expect(screen.queryByText('Alpha')).toBeNull()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('previews a prompt with @ references on select', async () => {
    mockedFetch.mockResolvedValue([prompt('1', 'Alpha')])
    mockedFetchTemplate.mockResolvedValue([
      { type: 'text', value: 'a portrait in ' },
      { type: 'asset', id: 'p2', name: 'style' }
    ])
    renderDialog()

    await userEvent.click(await screen.findByText('Alpha'))

    expect(await screen.findByText('a portrait in @style')).toBeInTheDocument()
  })

  it('deletes a prompt after confirmation', async () => {
    mockedFetch.mockResolvedValue([prompt('1', 'Alpha')])
    mockedDelete.mockResolvedValue()
    renderDialog()
    await userEvent.click(await screen.findByText('Alpha'))

    await userEvent.click(screen.getByText('Delete'))
    await userEvent.click(screen.getByText('Confirm delete'))

    expect(mockedDelete).toHaveBeenCalledWith('1')
  })

  it('renames a prompt when the name field is committed', async () => {
    mockedFetch.mockResolvedValue([prompt('1', 'Alpha')])
    mockedRename.mockResolvedValue()
    renderDialog()
    await userEvent.click(await screen.findByText('Alpha'))

    const nameInput = screen.getByDisplayValue('Alpha')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Renamed{enter}')

    expect(mockedRename).toHaveBeenCalledWith('1', '1', 'Renamed')
  })
})
