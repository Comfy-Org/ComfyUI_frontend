import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { TemplateInfo } from '@/platform/workflow/templates/types/template'

const mocks = vi.hoisted(() => ({
  loadWorkflowTemplate: vi.fn(async () => true),
  getTemplateThumbnailUrl: vi.fn(() => 'thumb.jpg'),
  getTemplateTitle: vi.fn(
    (template: TemplateInfo) => template.title ?? template.name
  ),
  controllerStart: vi.fn(async () => {}),
  selectorShow: vi.fn(),
  templatesByName: new Map<string, TemplateInfo>()
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
      getTemplateByName: (name: string) => mocks.templatesByName.get(name)
    })
  })
)

vi.mock('./useOnboardingTourController', () => ({
  useOnboardingTourController: () => ({ start: mocks.controllerStart })
}))

vi.mock('@/composables/useWorkflowTemplateSelectorDialog', () => ({
  useWorkflowTemplateSelectorDialog: () => ({ show: mocks.selectorShow })
}))

import GettingStartedScreen from './GettingStartedScreen.vue'
import { useOnboardingEntryStore } from '@/platform/workflow/persistence/onboardingEntryStore'

import enMessages from '@/locales/en/main.json'

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
    mocks.controllerStart.mockClear()
    mocks.selectorShow.mockClear()
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
    expect(mocks.controllerStart).toHaveBeenCalledWith('image_z_image_turbo')
    const loadOrder = mocks.loadWorkflowTemplate.mock.invocationCallOrder[0]
    const startOrder = mocks.controllerStart.mock.invocationCallOrder[0]
    expect(loadOrder).toBeLessThan(startOrder)
    expect(store.shouldShowGettingStarted).toBe(false)
  })

  it('keeps the screen up and does not start the tour when loading fails', async () => {
    mocks.loadWorkflowTemplate.mockResolvedValueOnce(false)
    const user = userEvent.setup()
    renderScreen()

    await user.click(
      screen.getByTestId('getting-started-card-video_ltx2_3_i2v')
    )

    expect(mocks.loadWorkflowTemplate).toHaveBeenCalled()
    expect(mocks.controllerStart).not.toHaveBeenCalled()
    expect(store.shouldShowGettingStarted).toBe(true)
  })

  it('does not start the tour or dismiss when loading rejects', async () => {
    mocks.loadWorkflowTemplate.mockRejectedValueOnce(new Error('load failed'))
    const user = userEvent.setup()
    renderScreen()

    await user.click(
      screen.getByTestId('getting-started-card-video_wan2_2_14B_i2v')
    )

    expect(mocks.controllerStart).not.toHaveBeenCalled()
    expect(store.shouldShowGettingStarted).toBe(true)
  })

  it('dismisses without starting the tour on Start from scratch', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(screen.getByTestId('getting-started-start-from-scratch'))

    expect(mocks.loadWorkflowTemplate).not.toHaveBeenCalled()
    expect(mocks.controllerStart).not.toHaveBeenCalled()
    expect(store.shouldShowGettingStarted).toBe(false)
  })

  it('opens the template selector on Discover all templates', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(screen.getByTestId('getting-started-discover-all'))

    expect(mocks.selectorShow).toHaveBeenCalledWith('command', {
      initialCategory: 'basics-getting-started'
    })
    expect(store.shouldShowGettingStarted).toBe(false)
  })

  it('shows a placeholder and no template cards on the Import tab', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(screen.getByRole('button', { name: /import workflow/i }))

    expect(
      screen.queryByTestId('getting-started-card-image_z_image_turbo')
    ).toBeNull()
    expect(screen.getByTestId('getting-started-placeholder')).toBeTruthy()
  })

  it('shows a placeholder on the Tutorials tab', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(screen.getByRole('button', { name: /tutorials/i }))

    expect(
      screen.queryByTestId('getting-started-card-image_z_image_turbo')
    ).toBeNull()
    expect(screen.getByTestId('getting-started-placeholder')).toBeTruthy()
  })

  it('does not render when the entry flag is off', () => {
    store.dismissGettingStarted()
    renderScreen()

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
