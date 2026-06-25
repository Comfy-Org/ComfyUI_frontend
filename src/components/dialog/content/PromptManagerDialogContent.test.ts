import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PromptManagerDialogContent from '@/components/dialog/content/PromptManagerDialogContent.vue'
import {
  createPrompt,
  deletePrompt,
  fetchPromptTemplate,
  fetchPromptVersions,
  fetchPrompts,
  renamePrompt,
  savePromptVersion
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

vi.mock('@/components/widget/layout/BaseModalLayout.vue', () => ({
  default: {
    name: 'BaseModalLayout',
    props: ['contentTitle', 'size', 'contentPadding', 'leftPanelWidth'],
    template: `
      <div data-testid="base-modal-layout">
        <slot name="leftPanelHeaderTitle" />
        <slot name="leftPanel" />
        <slot name="header" />
        <slot name="header-right-area" />
        <slot name="content" />
      </div>
    `
  }
}))

const mockedFetch = vi.mocked(fetchPrompts)
const mockedFetchTemplate = vi.mocked(fetchPromptTemplate)
const mockedCreate = vi.mocked(createPrompt)
const mockedSaveVersion = vi.mocked(savePromptVersion)
const mockedDelete = vi.mocked(deletePrompt)
const mockedRename = vi.mocked(renamePrompt)
const mockedVersions = vi.mocked(fetchPromptVersions)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { delete: 'Delete', cancel: 'Cancel', save: 'Save', close: 'Close' },
      promptNode: {
        managerTitle: 'Manage prompts',
        searchPlaceholder: 'Search prompts',
        namePlaceholder: 'Prompt name',
        editorPlaceholder:
          "Write a prompt, or type {'@'} to reference a saved prompt",
        managerEmpty: 'No saved prompts yet',
        managerNoMatches: 'No prompts match your search',
        managerSelectHint: 'Select a prompt, or create a new one',
        confirmDelete: 'Confirm delete',
        newPrompt: 'New prompt',
        editName: 'Edit name',
        menuVariables: 'Variables',
        menuSavedPrompts: 'Saved prompts',
        noMatches: 'No matches',
        historyTitle: 'History',
        historyEmpty: 'No versions yet',
        currentVersion: 'Current',
        viewVersion: 'View version',
        restore: 'Restore'
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
  mockedFetchTemplate.mockResolvedValue([])
  mockedVersions.mockResolvedValue([])
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

  it('loads the selected prompt into the editor', async () => {
    mockedFetch.mockResolvedValue([prompt('1', 'Alpha')])
    mockedFetchTemplate.mockResolvedValue([
      { type: 'text', value: 'a portrait in ' },
      { type: 'asset', id: 'p2', name: 'style' }
    ])
    renderDialog()

    await userEvent.click(await screen.findByText('Alpha'))

    expect(await screen.findByText('@style')).toBeInTheDocument()
  })

  it('creates a new prompt', async () => {
    mockedCreate.mockResolvedValue(prompt('new', 'Fresh'))
    renderDialog()

    await userEvent.click(screen.getByText('New prompt'))
    await userEvent.type(screen.getByPlaceholderText('Prompt name'), 'Fresh')
    await userEvent.click(screen.getByText('Save'))

    expect(mockedCreate).toHaveBeenCalledWith({ name: 'Fresh', template: [] })
  })

  it('renames via the name field without creating a content version', async () => {
    mockedFetch.mockResolvedValue([prompt('1', 'Alpha')])
    mockedRename.mockResolvedValue()
    renderDialog()
    await userEvent.click(await screen.findByText('Alpha'))

    await userEvent.click(screen.getByLabelText('Edit name'))
    const nameInput = await screen.findByDisplayValue('Alpha')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Renamed')
    await userEvent.click(screen.getByText('Save'))

    expect(mockedRename).toHaveBeenCalledWith('1', '1', 'Renamed')
    expect(mockedSaveVersion).not.toHaveBeenCalled()
  })

  it('deletes a prompt from the list on a confirming second click', async () => {
    mockedFetch.mockResolvedValue([prompt('1', 'Alpha')])
    mockedDelete.mockResolvedValue()
    renderDialog()
    await screen.findByText('Alpha')

    await userEvent.click(screen.getByLabelText('Delete'))
    expect(mockedDelete).not.toHaveBeenCalled()
    await userEvent.click(screen.getByLabelText('Delete'))

    expect(mockedDelete).toHaveBeenCalledWith('1')
  })

  it('previews a version in the editor without saving a new one', async () => {
    mockedFetch.mockResolvedValue([prompt('1', 'Alpha')])
    mockedVersions.mockResolvedValue([
      { assetId: 'v2', name: 'Alpha', createdAt: '2026-02-01T00:00:00Z' },
      { assetId: 'v1', name: 'Alpha', createdAt: '2026-01-01T00:00:00Z' }
    ])
    mockedFetchTemplate.mockImplementation(async (id) =>
      id === 'v1'
        ? [{ type: 'text', value: 'old version' }]
        : [{ type: 'text', value: 'latest' }]
    )
    renderDialog()
    await userEvent.click(await screen.findByText('Alpha'))
    await userEvent.click(screen.getByText('History'))

    const viewButtons = await screen.findAllByLabelText('View version')
    await userEvent.click(viewButtons[1])

    expect(await screen.findByText('old version')).toBeInTheDocument()
    expect(mockedSaveVersion).not.toHaveBeenCalled()
  })

  it('restores an older version as a new version', async () => {
    mockedFetch.mockResolvedValue([prompt('1', 'Alpha')])
    mockedVersions.mockResolvedValue([
      { assetId: 'v2', name: 'Alpha', createdAt: '2026-02-01T00:00:00Z' },
      { assetId: 'v1', name: 'Alpha', createdAt: '2026-01-01T00:00:00Z' }
    ])
    mockedFetchTemplate.mockResolvedValue([{ type: 'text', value: 'old' }])
    mockedSaveVersion.mockResolvedValue(prompt('1', 'Alpha'))
    renderDialog()
    await userEvent.click(await screen.findByText('Alpha'))

    await userEvent.click(screen.getByText('History'))
    await userEvent.click(await screen.findByText('Restore'))

    expect(mockedSaveVersion).toHaveBeenCalledWith('1', {
      name: 'Alpha',
      template: [{ type: 'text', value: 'old' }]
    })
  })
})
