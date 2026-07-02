import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import LinearGetStarted from './LinearGetStarted.vue'

const { loadTemplates, loadWorkflowTemplate, showDialog, loadFile } =
  vi.hoisted(() => ({
    loadTemplates: vi.fn(),
    loadWorkflowTemplate: vi.fn(),
    showDialog: vi.fn(),
    loadFile: vi.fn()
  }))

const enhancedTemplates = [
  { name: 'a.app', mediaType: 'image', mediaSubtype: 'webp', description: '' },
  {
    name: 'b.app',
    mediaType: 'image',
    mediaSubtype: 'webp',
    sourceModule: 'mymod',
    description: ''
  },
  { name: 'c', mediaType: 'image', mediaSubtype: 'webp', description: '' },
  { name: 'd.app', mediaType: 'image', mediaSubtype: 'webp', description: '' },
  { name: 'e.app', mediaType: 'image', mediaSubtype: 'webp', description: '' },
  { name: 'f.app', mediaType: 'image', mediaSubtype: 'webp', description: '' }
]

vi.mock(
  '@/platform/workflow/templates/composables/useTemplateWorkflows',
  () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ref } = require('vue')
    return {
      useTemplateWorkflows: () => ({
        isTemplatesLoaded: ref(true),
        loadingTemplateId: ref(null),
        loadTemplates,
        loadWorkflowTemplate,
        getTemplateTitle: (t: { name: string }) => `Title ${t.name}`,
        getEffectiveSourceModule: (t: { sourceModule?: string }) =>
          t.sourceModule || 'default',
        isAppTemplate: (t: { name: string }) => t.name.endsWith('.app'),
        getBaseThumbnailSrc: (t: { name: string }) => `url:${t.name}`
      })
    }
  }
)

vi.mock(
  '@/platform/workflow/templates/repositories/workflowTemplatesStore',
  () => ({
    useWorkflowTemplatesStore: () => ({ enhancedTemplates })
  })
)

vi.mock('@/composables/useWorkflowTemplateSelectorDialog', () => ({
  useWorkflowTemplateSelectorDialog: () => ({ show: showDialog })
}))

vi.mock('@/scripts/app', () => ({
  app: { ui: { loadFile } }
}))

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
  })

  it('loads templates on mount', () => {
    renderComponent()
    expect(loadTemplates).toHaveBeenCalled()
  })

  it('shows only the first four app templates', () => {
    renderComponent()
    const cards = screen.getAllByTestId('linear-get-started-template')
    expect(cards).toHaveLength(4)
    expect(screen.getByText('Title a.app')).toBeInTheDocument()
    expect(screen.getByText('Title e.app')).toBeInTheDocument()
    expect(screen.queryByText('Title f.app')).not.toBeInTheDocument()
    expect(screen.queryByText('Title c')).not.toBeInTheDocument()
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

  it('opens the file picker when import is clicked', async () => {
    const user = userEvent.setup()
    renderComponent()
    await user.click(screen.getByTestId('linear-get-started-import'))
    expect(loadFile).toHaveBeenCalled()
  })

  it('opens the template selector when discover all is clicked', async () => {
    const user = userEvent.setup()
    renderComponent()
    await user.click(screen.getByTestId('linear-get-started-discover'))
    expect(showDialog).toHaveBeenCalledWith('appbuilder')
  })
})
