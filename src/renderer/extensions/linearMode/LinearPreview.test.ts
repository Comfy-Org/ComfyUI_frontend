import { fromPartial } from '@total-typescript/shoehorn'

import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { computed, defineComponent } from 'vue'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useAppMode } from '@/composables/useAppMode'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import LinearPreview from './LinearPreview.vue'
import type { OutputSelection } from './linearModeTypes'

const outputHistoryState = vi.hoisted(() => ({
  isWorkflowActive: false
}))

const spies = vi.hoisted(() => ({
  cancelActiveWorkflowJobs: vi.fn(),
  deleteAssets: vi.fn()
}))

vi.mock(import('@/composables/useAppMode'))

vi.mock<unknown>(
  import('@/renderer/extensions/linearMode/useOutputHistory'),
  async () => {
    const { computed } = await import('vue')
    return {
      useOutputHistory: () => ({
        allOutputs: () => [],
        isWorkflowActive: computed(() => outputHistoryState.isWorkflowActive),
        cancelActiveWorkflowJobs: spies.cancelActiveWorkflowJobs
      })
    }
  }
)

vi.mock<unknown>(
  import('@/platform/assets/composables/useMediaAssetActions'),
  () => ({
    useMediaAssetActions: () => ({ deleteAssets: spies.deleteAssets })
  })
)

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { rootGraph: { id: 'root' }, loadGraphData: vi.fn() }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { download: 'Download', moreOptions: 'More Options' },
      linearMode: {
        rerun: 'Rerun',
        reuseParameters: 'Reuse Parameters',
        cancelThisRun: 'Cancel this run',
        deleteAllAssets: 'Delete all',
        downloadAll: 'Download all'
      }
    }
  }
})

function renderPreview(
  props: { mobile?: boolean } = {},
  emitSelection?: OutputSelection
) {
  // happy-dom focuses Reka's non-focusable wrapper: https://github.com/unovue/reka-ui/issues/2803
  const preventAutofocus = (event: Event) => event.preventDefault()
  document.addEventListener(
    'focusScope.autoFocusOnMount',
    preventAutofocus,
    true
  )
  onTestFinished(() =>
    document.removeEventListener(
      'focusScope.autoFocusOnMount',
      preventAutofocus,
      true
    )
  )
  const user = userEvent.setup()
  const outputHistoryStub = emitSelection
    ? defineComponent({
        emits: ['update-selection'],
        mounted() {
          this.$emit('update-selection', emitSelection)
        },
        template: '<div data-testid="output-history" />'
      })
    : {
        template: '<div data-testid="output-history" />'
      }
  const result = render(LinearPreview, {
    props,
    global: {
      plugins: [i18n],
      directives: { tooltip: {} },
      stubs: {
        ImagePreview: { template: '<div data-testid="image-preview" />' },
        LatentPreview: { template: '<div data-testid="latent-preview" />' },
        LinearWelcome: { template: '<div data-testid="linear-welcome" />' },
        LinearArrange: { template: '<div data-testid="linear-arrange" />' },
        MediaOutputPreview: true,
        OutputHistory: outputHistoryStub
      }
    }
  })
  return { ...result, user }
}

describe('LinearPreview', () => {
  beforeEach(() => {
    useAppMode().isBuilderMode = computed(() => false)
    useAppMode().isArrangeMode = computed(() => false)
    outputHistoryState.isWorkflowActive = false
  })

  it('renders the welcome screen and output history when idle', () => {
    renderPreview()

    expect(screen.getByTestId('linear-welcome')).toBeInTheDocument()
    expect(screen.getByTestId('output-history')).toBeInTheDocument()
  })

  it('hides the output history in builder mode', () => {
    useAppMode().isBuilderMode = computed(() => true)

    renderPreview()

    expect(screen.queryByTestId('output-history')).not.toBeInTheDocument()
  })

  it('shows the arrange view in arrange mode', () => {
    useAppMode().isArrangeMode = computed(() => true)

    renderPreview()

    expect(screen.getByTestId('linear-arrange')).toBeInTheDocument()
    expect(screen.queryByTestId('linear-welcome')).not.toBeInTheDocument()
  })

  it('shows the latent preview and cancel control while a workflow is active', async () => {
    outputHistoryState.isWorkflowActive = true

    const { user } = renderPreview()

    expect(screen.getByTestId('latent-preview')).toBeInTheDocument()

    await user.click(screen.getByTestId('linear-cancel-run'))

    expect(spies.cancelActiveWorkflowJobs).toHaveBeenCalled()
  })

  it('shows the selected asset actions and latent image when a selection is made', async () => {
    const asset = fromPartial<AssetItem>({
      id: 'a1',
      name: 'out.png',
      tags: []
    })
    const selection: OutputSelection = {
      asset,
      canShowPreview: true,
      latentPreviewUrl: 'blob:preview'
    }

    renderPreview({}, selection)

    expect(await screen.findByTestId('linear-output-info')).toBeInTheDocument()
    expect(screen.getByTestId('image-preview')).toBeInTheDocument()
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'More Options' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Delete all')
    expect(screen.getByText('Rerun')).toBeInTheDocument()
    expect(screen.getByText('Reuse Parameters')).toBeInTheDocument()
  })
})
