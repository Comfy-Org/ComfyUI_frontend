import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import { getActivePinia } from 'pinia'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import { useDialogStore } from '@/stores/dialogStore'

import { CURATED_TEMPLATE_IDS, FALLBACK_TEMPLATE_IDS } from './tutorialCards'

const mocks = vi.hoisted(() => ({
  dismiss: vi.fn(),
  dismissIntoTour: vi.fn(),
  loadTemplate:
    vi.fn<ReturnType<typeof useTemplateWorkflows>['loadWorkflowTemplate']>(),

  loadingTemplateId: { value: null as string | null }
}))

// The screen hands the template path to `dismissIntoFirstRunTour` as one call,
// so this file cannot see - and must not restate - how the dismissal and the
// tour are ordered inside it. That is pinned in `firstRunEntry.test.ts`.
vi.mock<unknown>(import('./firstRunEntry'), () => ({
  useFirstRunEntry: () => ({
    dismissGettingStarted: mocks.dismiss,
    dismissIntoFirstRunTour: mocks.dismissIntoTour
  })
}))

vi.mock<unknown>(
  import('@/platform/workflow/templates/composables/useTemplateWorkflows'),
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

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const FocusScopeStub = {
  props: ['trapped', 'asChild', 'loop'],
  template:
    '<div data-testid="focus-scope-stub" :data-trapped="trapped"><slot /></div>'
}

async function renderScreen({
  stubFocusScope = false,
  withOpenDialog = false
} = {}) {
  const pinia = getActivePinia()!
  if (withOpenDialog) {
    useDialogStore().showDialog({ component: { template: '<div />' } })
  }
  const { default: GettingStartedScreen } =
    await import('./GettingStartedScreen.vue')
  return render(GettingStartedScreen, {
    global: {
      plugins: [i18n, pinia],
      stubs: stubFocusScope ? { FocusScope: FocusScopeStub } : {}
    }
  })
}

beforeEach(() => {
  vi.mocked(useWorkflowTemplatesStore().getTemplateByName).mockImplementation(
    (name) =>
      useWorkflowTemplatesStore().enhancedTemplates.find(
        (template) => template.name === name
      )
  )
})

describe('GettingStartedScreen', () => {
  beforeEach(() => {
    useWorkflowTemplatesStore().isLoaded = true
    Object.assign(useWorkflowTemplatesStore(), {
      enhancedTemplates: CURATED_TEMPLATE_IDS.map((name) => ({ name }))
    })
    mocks.loadTemplate.mockResolvedValue('loaded')
    vi.mocked(
      useWorkflowTemplatesStore().loadWorkflowTemplates
    ).mockResolvedValue(undefined)
    mocks.dismissIntoTour.mockResolvedValue(undefined)
    mocks.loadingTemplateId.value = null
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
    expect(
      mocks.dismissIntoTour,
      'dismissing and touring separately would expose the gap between them'
    ).toHaveBeenCalledWith(CURATED_TEMPLATE_IDS[0])
    expect(
      mocks.dismiss,
      'the bare dismissal belongs to the exits, not to the template path'
    ).not.toHaveBeenCalled()
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
    await renderScreen()

    await pickFirstTemplate()

    await waitFor(() => expect(mocks.dismissIntoTour).toHaveBeenCalled())
    expect(
      screen.queryByText(enMessages.gettingStarted.templateFailed),
      'the template loaded; a tour that declined to open is not a failed load'
    ).toBeNull()
  })

  it('keeps the click handler from rejecting when the tour cannot start', async () => {
    mocks.dismissIntoTour.mockRejectedValue(new Error('tour unavailable'))
    const rejections: unknown[] = []
    const onRejection = (reason: unknown) => rejections.push(reason)
    process.on('unhandledRejection', onRejection)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await renderScreen()

    await pickFirstTemplate()

    await waitFor(() => expect(mocks.dismissIntoTour).toHaveBeenCalled())
    await new Promise((resolve) => setImmediate(resolve))
    process.off('unhandledRejection', onRejection)

    expect(
      rejections,
      'the graph is already loaded, so a tour that throws must not escape the click'
    ).toEqual([])
  })

  describe('grid', () => {
    it('fills from the catalog when no curated template survived a package skew', async () => {
      Object.assign(useWorkflowTemplatesStore(), {
        enhancedTemplates: [
          { name: 'skew-a' },
          { name: 'skew-b' },
          { name: 'skew-c' },
          { name: 'skew-d' },
          { name: 'skew-e' }
        ]
      })

      await renderScreen()

      expect(
        screen.getAllByTestId(/^getting-started-card-skew-/),
        'A loaded catalog sharing none of the pinned ids must still fill the grid, not leave the user on empty space'
      ).toHaveLength(CURATED_TEMPLATE_IDS.length)
    })

    it('keeps curated templates ahead of the ones it backfills', async () => {
      Object.assign(useWorkflowTemplatesStore(), {
        enhancedTemplates: [
          { name: 'catalog-filler' },
          { name: FALLBACK_TEMPLATE_IDS[0] },
          { name: CURATED_TEMPLATE_IDS[1] }
        ]
      })

      await renderScreen()

      const ids = screen
        .getAllByTestId(/^getting-started-card-/)
        .map((card) => card.getAttribute('data-testid'))

      expect(
        ids,
        'the curated pick is the one the grid was designed around, so it must not be pushed out of the grid by catalog order'
      ).toEqual([
        `getting-started-card-${CURATED_TEMPLATE_IDS[1]}`,
        `getting-started-card-${FALLBACK_TEMPLATE_IDS[0]}`,
        'getting-started-card-catalog-filler'
      ])
    })
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

  describe('dialog arbitration', () => {
    it('takes focus and modal semantics when it mounts with no dialog open', async () => {
      await renderScreen()
      await nextTick()

      const takeover = screen.getByRole('dialog')
      expect(takeover).toHaveFocus()
      expect(takeover.getAttribute('aria-modal')).toBe('true')
    })

    it('leaves focus and modality with a dialog that was open before it mounted', async () => {
      await renderScreen({ withOpenDialog: true })
      await nextTick()

      const takeover = screen.getByRole('dialog')
      expect(
        takeover,
        'stealing focus on mount would pull the user out of the open dialog (desktop sign-in approval)'
      ).not.toHaveFocus()
      expect(takeover.getAttribute('aria-modal')).toBe('false')
    })

    it('releases its focus trap while a dialog is open and re-arms after', async () => {
      await renderScreen({ stubFocusScope: true })
      const dialogStore = useDialogStore()
      const trapped = () =>
        screen.getByTestId('focus-scope-stub').getAttribute('data-trapped')

      expect(trapped()).toBe('true')

      const dialog = dialogStore.showDialog({
        component: { template: '<div />' }
      })
      await nextTick()
      expect(
        trapped(),
        'a trapped takeover under an open dialog (desktop sign-in approval, invite links) makes the dialog unreachable'
      ).toBe('false')

      dialogStore.closeDialog({ key: dialog.key })
      await nextTick()
      expect(
        trapped(),
        'the takeover must re-arm once the dialog stack empties'
      ).toBe('true')
    })
  })

  describe('failures', () => {
    it.for(['not-started', 'graph-failed'] as const)(
      'surfaces a %s template load and keeps the screen up to retry',
      async (result) => {
        mocks.loadTemplate.mockResolvedValue(result)
        await renderScreen()

        await pickFirstTemplate()

        expect(
          await screen.findByText(enMessages.gettingStarted.templateFailed)
        ).toBeVisible()
        expect(
          mocks.dismissIntoTour,
          'A failed load must not dismiss the screen; the user would be left on a bare canvas'
        ).not.toHaveBeenCalled()
        expect(screen.getByText(enMessages.gettingStarted.retry)).toBeTruthy()
      }
    )

    it('retries a catalog load that resolved without loading anything', async () => {
      useWorkflowTemplatesStore().isLoaded = false
      await renderScreen()

      const retry = await screen.findByTestId(
        'getting-started-retry-catalog',
        undefined,
        {
          timeout: 1000
        }
      )
      vi.mocked(
        useWorkflowTemplatesStore().loadWorkflowTemplates
      ).mockImplementation(() => {
        useWorkflowTemplatesStore().isLoaded = true
        return Promise.resolve(undefined)
      })
      await userEvent.click(retry)

      expect(
        vi.mocked(useWorkflowTemplatesStore().loadWorkflowTemplates),
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
