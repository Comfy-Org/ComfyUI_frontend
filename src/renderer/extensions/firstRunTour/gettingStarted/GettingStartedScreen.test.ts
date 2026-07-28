import { createTestingPinia } from '@pinia/testing'
import userEvent from '@testing-library/user-event'
import { cleanup, render, screen, waitFor } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { CURATED_TEMPLATE_IDS } from './tutorialCards'

const mocks = vi.hoisted(() => ({
  dismiss: vi.fn(),
  beginTour: vi.fn(),
  loadTemplate: vi.fn(),
  loadCatalog: vi.fn(),
  isLoaded: true,
  toastAdd: vi.fn(),
  loadingTemplateId: { value: null as string | null }
}))

vi.mock('./firstRunEntry', () => ({
  useFirstRunEntry: () => ({ dismissGettingStarted: mocks.dismiss })
}))

vi.mock('../tour/useFirstRunTourController', () => ({
  useFirstRunTourController: () => ({ beginTour: mocks.beginTour })
}))

vi.mock(
  '@/platform/workflow/templates/composables/useTemplateWorkflows',
  async () => {
    const { ref } = await import('vue')
    mocks.loadingTemplateId = ref<string | null>(null)
    return {
      useTemplateWorkflows: () => ({
        loadWorkflowTemplate: mocks.loadTemplate,
        loadingTemplateId: mocks.loadingTemplateId,
        getTemplateThumbnailUrl: () => 'thumb.png',
        getTemplateTitle: (template: { name: string }) => template.name
      })
    }
  }
)

vi.mock(
  '@/platform/workflow/templates/repositories/workflowTemplatesStore',
  () => ({
    useWorkflowTemplatesStore: () => ({
      get isLoaded() {
        return mocks.isLoaded
      },
      loadWorkflowTemplates: mocks.loadCatalog,
      getTemplateByName: (name: string) => ({ name })
    })
  })
)

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: mocks.toastAdd })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

async function renderScreen() {
  const { default: GettingStartedScreen } =
    await import('./GettingStartedScreen.vue')
  return render(GettingStartedScreen, { global: { plugins: [i18n] } })
}

describe('GettingStartedScreen', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    mocks.isLoaded = true
    mocks.loadTemplate.mockResolvedValue(true)
    mocks.loadCatalog.mockResolvedValue(undefined)
    mocks.beginTour.mockResolvedValue(true)
    mocks.loadingTemplateId.value = null
  })

  afterEach(() => {
    cleanup()
    document.body.replaceChildren()
  })

  async function pickFirstTemplate() {
    await userEvent.click(
      screen.getByTestId(`getting-started-card-${CURATED_TEMPLATE_IDS[0]}`)
    )
  }

  it('loads the chosen template and tours it', async () => {
    await renderScreen()

    await pickFirstTemplate()

    await waitFor(() =>
      expect(mocks.loadTemplate).toHaveBeenCalledWith(
        CURATED_TEMPLATE_IDS[0],
        'default'
      )
    )
    expect(mocks.beginTour).toHaveBeenCalledWith(CURATED_TEMPLATE_IDS[0])
    expect(mocks.dismiss).toHaveBeenCalled()
  })

  it('ignores a second pick while one is still loading', async () => {
    await renderScreen()
    mocks.loadingTemplateId.value = CURATED_TEMPLATE_IDS[0]

    await userEvent.click(
      screen.getByTestId(`getting-started-card-${CURATED_TEMPLATE_IDS[1]}`)
    )

    expect(
      mocks.loadTemplate,
      'a second template loading over the first leaves the tour on the wrong graph'
    ).not.toHaveBeenCalled()
  })

  it('leaves the user on the loaded graph when the template has no tour', async () => {
    mocks.beginTour.mockResolvedValue(false)
    await renderScreen()

    await pickFirstTemplate()

    await waitFor(() =>
      expect(
        mocks.dismiss,
        'the graph is loaded and usable, so the takeover must not strand the user on it'
      ).toHaveBeenCalled()
    )
  })

  describe('exits', () => {
    it('offers a blank-canvas action', async () => {
      await renderScreen()

      await userEvent.click(screen.getByTestId('getting-started-blank'))

      expect(
        mocks.dismiss,
        'A first-run user must always have a visible way out of the takeover'
      ).toHaveBeenCalled()
    })

    it('exits on Escape', async () => {
      await renderScreen()

      await userEvent.keyboard('{Escape}')

      expect(
        mocks.dismiss,
        'Escape must follow the same safe dismissal path as the blank-canvas action'
      ).toHaveBeenCalled()
    })
  })

  describe('failures', () => {
    it('surfaces a failed template load and keeps the screen up to retry', async () => {
      mocks.loadTemplate.mockResolvedValue(false)
      await renderScreen()

      await pickFirstTemplate()

      await waitFor(() => expect(mocks.toastAdd).toHaveBeenCalled())
      expect(
        mocks.dismiss,
        'A failed load must not dismiss the screen; the user would be left on a bare canvas'
      ).not.toHaveBeenCalled()
      expect(screen.getByText(enMessages.gettingStarted.retry)).toBeTruthy()
    })

    it('retries a catalog load that resolved without loading anything', async () => {
      mocks.isLoaded = false
      await renderScreen()

      const retry = await screen.findByTestId(
        'getting-started-retry-catalog',
        undefined,
        {
          timeout: 1000
        }
      )
      mocks.loadCatalog.mockImplementation(() => {
        mocks.isLoaded = true
        return Promise.resolve(undefined)
      })
      await userEvent.click(retry)

      expect(
        mocks.loadCatalog,
        'The store swallows fetch errors and resolves with isLoaded false, so a failed catalog must be detected without a rejection'
      ).toHaveBeenCalledTimes(2)
      await waitFor(() =>
        expect(
          screen.queryByTestId('getting-started-retry-catalog'),
          'A successful retry must replace the error state with the grid'
        ).toBeNull()
      )
    })
  })
})
