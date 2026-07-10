import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { TemplateInfo } from '@/platform/workflow/templates/types/template'

import LinearGetStarted from './LinearGetStarted.vue'

const {
  templatesState,
  loadTemplates,
  loadWorkflowTemplate,
  showDialog,
  executeCommand,
  addToast
} = vi.hoisted(() => ({
  templatesState: {
    isTemplatesLoaded: true,
    loadingTemplateId: null as string | null,
    enhancedTemplates: [] as TemplateInfo[]
  },
  loadTemplates: vi.fn(),
  loadWorkflowTemplate: vi.fn(),
  showDialog: vi.fn(),
  executeCommand: vi.fn(),
  addToast: vi.fn()
}))

vi.mock(
  '@/platform/workflow/templates/composables/useTemplateWorkflows',
  async () => {
    const { computed } = await import('vue')
    return {
      useTemplateWorkflows: () => ({
        isTemplatesLoaded: computed(() => templatesState.isTemplatesLoaded),
        loadingTemplateId: computed(() => templatesState.loadingTemplateId),
        loadTemplates,
        loadWorkflowTemplate
      })
    }
  }
)

vi.mock(
  '@/platform/workflow/templates/repositories/workflowTemplatesStore',
  () => ({
    useWorkflowTemplatesStore: () => ({
      get enhancedTemplates() {
        return templatesState.enhancedTemplates
      }
    })
  })
)

vi.mock('@/composables/useWorkflowTemplateSelectorDialog', () => ({
  useWorkflowTemplateSelectorDialog: () => ({ show: showDialog })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({ execute: executeCommand })
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: addToast })
}))

vi.mock('@/scripts/api', () => ({
  api: {
    fileURL: (path: string) => path,
    apiURL: (path: string) => path
  }
}))

function makeTemplate(name: string, sourceModule?: string): TemplateInfo {
  return {
    name,
    mediaType: 'image',
    mediaSubtype: 'webp',
    description: '',
    ...(sourceModule && { sourceModule })
  }
}

const i18n = createI18n({ legacy: false, locale: 'en', missingWarn: false })

function renderComponent() {
  return render(LinearGetStarted, {
    global: {
      plugins: [i18n],
      stubs: {
        LazyImage: { template: '<div />' }
      }
    }
  })
}

describe('LinearGetStarted', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    templatesState.isTemplatesLoaded = true
    templatesState.loadingTemplateId = null
    templatesState.enhancedTemplates = [
      makeTemplate('a.app'),
      makeTemplate('b.app', 'mymod'),
      makeTemplate('c'),
      makeTemplate('d.app'),
      makeTemplate('e.app'),
      makeTemplate('f.app')
    ]
    loadWorkflowTemplate.mockResolvedValue(true)
  })

  it('loads templates on mount', () => {
    renderComponent()
    expect(loadTemplates).toHaveBeenCalled()
  })

  it('shows only the first four app templates', () => {
    renderComponent()
    const cards = screen.getAllByTestId('linear-get-started-template')
    expect(cards).toHaveLength(4)
    expect(screen.getByText('a.app')).toBeInTheDocument()
    expect(screen.getByText('e.app')).toBeInTheDocument()
    expect(screen.queryByText('f.app')).not.toBeInTheDocument()
    expect(screen.queryByText('c')).not.toBeInTheDocument()
  })

  it('falls back to the first four templates when none target app mode', () => {
    templatesState.enhancedTemplates = [
      makeTemplate('one'),
      makeTemplate('two'),
      makeTemplate('three'),
      makeTemplate('four'),
      makeTemplate('five')
    ]
    renderComponent()
    const cards = screen.getAllByTestId('linear-get-started-template')
    expect(cards).toHaveLength(4)
    expect(screen.getByText('one')).toBeInTheDocument()
    expect(screen.queryByText('five')).not.toBeInTheDocument()
  })

  it('loads a template with its source module when a card is clicked', async () => {
    const user = userEvent.setup()
    renderComponent()
    const cards = screen.getAllByTestId('linear-get-started-template')
    await user.click(cards[1])
    expect(loadWorkflowTemplate).toHaveBeenCalledWith('b.app', 'mymod')
  })

  it('defaults the source module when a card has none', async () => {
    const user = userEvent.setup()
    renderComponent()
    const cards = screen.getAllByTestId('linear-get-started-template')
    await user.click(cards[0])
    expect(loadWorkflowTemplate).toHaveBeenCalledWith('a.app', 'default')
  })

  it('disables cards and actions while a template is loading', async () => {
    const user = userEvent.setup()
    templatesState.loadingTemplateId = 'a.app'
    renderComponent()
    const cards = screen.getAllByTestId('linear-get-started-template')
    await user.click(cards[1])
    expect(loadWorkflowTemplate).not.toHaveBeenCalled()
    expect(screen.getByTestId('linear-get-started-import')).toBeDisabled()
    expect(screen.getByTestId('linear-get-started-discover')).toBeDisabled()
  })

  it('shows an error toast when loading a template fails', async () => {
    const user = userEvent.setup()
    loadWorkflowTemplate.mockResolvedValue(false)
    renderComponent()
    await user.click(screen.getAllByTestId('linear-get-started-template')[0])
    await vi.waitFor(() =>
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'linearMode.getStarted.loadFailed'
        })
      )
    )
  })

  it('opens a workflow via the command store when import is clicked', async () => {
    const user = userEvent.setup()
    renderComponent()
    await user.click(screen.getByTestId('linear-get-started-import'))
    expect(executeCommand).toHaveBeenCalledWith('Comfy.OpenWorkflow')
  })

  it('opens the template selector when discover all is clicked', async () => {
    const user = userEvent.setup()
    renderComponent()
    await user.click(screen.getByTestId('linear-get-started-discover'))
    expect(showDialog).toHaveBeenCalledWith('appbuilder')
  })
})
