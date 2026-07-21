import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useOnboardingEntryStore } from '@/platform/workflow/persistence/onboardingEntryStore'
import type { TemplateInfo } from '@/platform/workflow/templates/types/template'
import GettingStartedScreen from '@/renderer/extensions/firstRunTour/GettingStartedScreen.vue'
import {
  FALLBACK_TEMPLATE_IDS,
  tutorialCards
} from '@/renderer/extensions/firstRunTour/tutorialCards'

const mocks = vi.hoisted(() => ({
  loadWorkflowTemplate: vi.fn(async () => true),
  getTemplateThumbnailUrl: vi.fn(() => 'thumb.jpg'),
  getTemplateTitle: vi.fn(
    (template: TemplateInfo) => template.title ?? template.name
  ),
  controllerBeginTour: vi.fn(async () => {}),
  templatesByName: new Map<string, TemplateInfo>(),
  templatesLoaded: true,
  loadWorkflowTemplates: vi.fn(async () => {})
}))

function makeTemplate(name: string, title: string): TemplateInfo {
  return {
    name,
    title,
    mediaType: 'image',
    mediaSubtype: 'jpg',
    description: ''
  }
}

const CARD_IDS = [
  'image_krea2_turbo_t2i',
  'image_z_image_turbo',
  'video_ltx2_3_i2v',
  'video_wan2_2_14B_i2v'
] as const

vi.mock(
  '@/platform/workflow/templates/composables/useTemplateWorkflows',
  () => ({
    useTemplateWorkflows: () => ({
      loadWorkflowTemplate: mocks.loadWorkflowTemplate,
      getTemplateThumbnailUrl: mocks.getTemplateThumbnailUrl,
      getTemplateTitle: mocks.getTemplateTitle
    })
  })
)

vi.mock(
  '@/platform/workflow/templates/repositories/workflowTemplatesStore',
  () => ({
    useWorkflowTemplatesStore: () => ({
      getTemplateByName: (name: string) => mocks.templatesByName.get(name),
      get isLoaded() {
        return mocks.templatesLoaded
      },
      loadWorkflowTemplates: mocks.loadWorkflowTemplates
    })
  })
)

vi.mock('./useFirstRunTourController', () => ({
  useFirstRunTourController: () => ({ beginTour: mocks.controllerBeginTour })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderScreen() {
  return render(GettingStartedScreen, { global: { plugins: [i18n] } })
}

describe('GettingStartedScreen', () => {
  let store: ReturnType<typeof useOnboardingEntryStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useOnboardingEntryStore()
    store.showGettingStarted()

    mocks.loadWorkflowTemplate.mockClear()
    mocks.controllerBeginTour.mockClear()
    mocks.loadWorkflowTemplates.mockClear()
    mocks.templatesLoaded = true
    mocks.templatesByName.clear()
    CARD_IDS.forEach((id, i) =>
      mocks.templatesByName.set(id, makeTemplate(id, `Template ${i + 1}`))
    )
  })

  it('renders the four curated template cards on the Templates tab', () => {
    renderScreen()

    for (const id of CARD_IDS) {
      expect(screen.getByTestId(`getting-started-card-${id}`)).toBeTruthy()
    }
  })

  it('backfills only the shortfall when curated templates are missing', () => {
    mocks.templatesByName.delete('video_ltx2_3_i2v')
    FALLBACK_TEMPLATE_IDS.forEach((id) =>
      mocks.templatesByName.set(id, makeTemplate(id, id))
    )
    renderScreen()

    expect(screen.getAllByTestId(/^getting-started-card-/)).toHaveLength(
      CARD_IDS.length
    )
    expect(
      screen.getByTestId(`getting-started-card-${FALLBACK_TEMPLATE_IDS[0]}`)
    ).toBeTruthy()
    expect(
      screen.queryByTestId(`getting-started-card-${FALLBACK_TEMPLATE_IDS[1]}`)
    ).toBeNull()
  })

  it('leaves the grid untouched when every curated template resolves', () => {
    FALLBACK_TEMPLATE_IDS.forEach((id) =>
      mocks.templatesByName.set(id, makeTemplate(id, id))
    )
    renderScreen()

    for (const id of CARD_IDS) {
      expect(screen.getByTestId(`getting-started-card-${id}`)).toBeTruthy()
    }
    expect(
      screen.queryByTestId(`getting-started-card-${FALLBACK_TEMPLATE_IDS[0]}`)
    ).toBeNull()
  })

  it('keeps tutorial thumbnails resolvable when their template is missing', async () => {
    mocks.templatesByName.delete('video_ltx2_3_i2v')
    renderScreen()
    mocks.getTemplateThumbnailUrl.mockClear()
    await userEvent.click(screen.getByRole('tab', { name: /tutorials/i }))

    expect(
      mocks.getTemplateThumbnailUrl,
      'Every tutorial resolves a thumbnail from some loaded template'
    ).toHaveBeenCalledTimes(tutorialCards.length)
  })

  it('loads the templates store when opened unloaded so cards can resolve', () => {
    mocks.templatesLoaded = false
    renderScreen()

    expect(mocks.loadWorkflowTemplates).toHaveBeenCalledOnce()
  })

  it('does not reload the templates store when it is already loaded', () => {
    mocks.templatesLoaded = true
    renderScreen()

    expect(mocks.loadWorkflowTemplates).not.toHaveBeenCalled()
  })

  it('does not load the templates store while the screen is hidden', () => {
    store.dismissGettingStarted()
    mocks.templatesLoaded = false
    renderScreen()

    expect(mocks.loadWorkflowTemplates).not.toHaveBeenCalled()
  })

  it('loads the template then starts the tour when a card is picked', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(
      screen.getByTestId('getting-started-card-image_z_image_turbo')
    )

    expect(mocks.loadWorkflowTemplate).toHaveBeenCalledWith(
      'image_z_image_turbo',
      'default'
    )
    expect(mocks.controllerBeginTour).toHaveBeenCalledWith({
      templateId: 'image_z_image_turbo'
    })
    const loadOrder = mocks.loadWorkflowTemplate.mock.invocationCallOrder[0]
    const startOrder = mocks.controllerBeginTour.mock.invocationCallOrder[0]
    expect(loadOrder).toBeLessThan(startOrder)
    expect(store.shouldShowGettingStarted).toBe(false)
  })

  it('marks the picked card busy while the template loads and the tour prepares', async () => {
    let resolveLoad: (loaded: boolean) => void = () => {}
    mocks.loadWorkflowTemplate.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveLoad = resolve
      })
    )
    const user = userEvent.setup()
    renderScreen()

    const cardId = 'getting-started-card-image_z_image_turbo'
    await user.click(screen.getByTestId(cardId))

    await vi.waitFor(() =>
      expect(screen.getByTestId(cardId)).toHaveAttribute('aria-busy', 'true')
    )

    resolveLoad(true)
  })

  it('keeps the screen up and does not start the tour when loading fails', async () => {
    mocks.loadWorkflowTemplate.mockResolvedValueOnce(false)
    const user = userEvent.setup()
    renderScreen()

    await user.click(
      screen.getByTestId('getting-started-card-video_ltx2_3_i2v')
    )

    expect(mocks.loadWorkflowTemplate).toHaveBeenCalled()
    expect(mocks.controllerBeginTour).not.toHaveBeenCalled()
    expect(store.shouldShowGettingStarted).toBe(true)
  })

  it('does not start the tour or dismiss when loading rejects', async () => {
    mocks.loadWorkflowTemplate.mockRejectedValueOnce(new Error('load failed'))
    const user = userEvent.setup()
    renderScreen()

    await user.click(
      screen.getByTestId('getting-started-card-video_wan2_2_14B_i2v')
    )

    expect(mocks.controllerBeginTour).not.toHaveBeenCalled()
    expect(store.shouldShowGettingStarted).toBe(true)
  })

  it('does not offer the Import workflow tab', () => {
    renderScreen()

    expect(screen.queryByRole('tab', { name: /import workflow/i })).toBeNull()
    expect(screen.getAllByRole('tab')).toHaveLength(2)
  })

  it('shows a message instead of endless skeletons when the catalog load fails', async () => {
    mocks.templatesLoaded = false
    mocks.loadWorkflowTemplates.mockRejectedValueOnce(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderScreen()

    await vi.waitFor(() =>
      expect(
        screen.getByText(enMessages.onboardingTour.gettingStarted.loadFailed)
      ).toBeTruthy()
    )
    expect(
      screen.queryAllByTestId('getting-started-card-skeleton')
    ).toHaveLength(0)
  })

  it('shows skeleton cards instead of an empty grid while templates load', () => {
    mocks.templatesLoaded = false
    renderScreen()

    expect(screen.getAllByTestId('getting-started-card-skeleton')).toHaveLength(
      CARD_IDS.length
    )
    expect(
      screen.queryByTestId('getting-started-card-image_z_image_turbo')
    ).toBeNull()
  })

  it('opens the tutorial docs in a new tab when a tutorial card is picked', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    const user = userEvent.setup()
    renderScreen()

    await user.click(screen.getByRole('tab', { name: /tutorials/i }))
    await user.click(
      screen.getByTestId('getting-started-tutorial-text-to-image')
    )

    expect(openSpy).toHaveBeenCalledWith(
      'https://docs.comfy.org/tutorials/basic/text-to-image',
      '_blank',
      'noopener,noreferrer'
    )
    expect(mocks.controllerBeginTour).not.toHaveBeenCalled()
    expect(store.shouldShowGettingStarted).toBe(true)

    openSpy.mockRestore()
  })

  it('renders a card per tutorial on the Tutorials tab', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(screen.getByRole('tab', { name: /tutorials/i }))

    for (const tutorial of tutorialCards) {
      expect(
        screen.getByTestId(`getting-started-tutorial-${tutorial.id}`)
      ).toBeTruthy()
    }
    expect(
      screen.queryByTestId('getting-started-card-image_z_image_turbo')
    ).toBeNull()
  })

  it('badges tutorial cards so they read apart from the template cards', async () => {
    const user = userEvent.setup()
    renderScreen()

    expect(screen.queryByTestId('getting-started-card-badge')).toBeNull()

    await user.click(screen.getByRole('tab', { name: /tutorials/i }))

    expect(screen.getAllByTestId('getting-started-card-badge')).toHaveLength(
      tutorialCards.length
    )
  })

  it('does not render when the entry flag is off', () => {
    store.dismissGettingStarted()
    renderScreen()

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
