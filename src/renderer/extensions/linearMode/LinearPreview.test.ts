import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import LinearPreview from './LinearPreview.vue'
import type { OutputSelection } from './linearModeTypes'

const appModeState = vi.hoisted(() => ({
  isBuilderMode: false,
  isArrangeMode: false
}))

const outputHistoryState = vi.hoisted(() => ({
  isWorkflowActive: false
}))

const spies = vi.hoisted(() => ({
  cancelActiveWorkflowJobs: vi.fn(),
  deleteAssets: vi.fn()
}))

vi.mock('@/composables/useAppMode', async () => {
  const { computed } = await import('vue')
  return {
    useAppMode: () => ({
      isBuilderMode: computed(() => appModeState.isBuilderMode),
      isArrangeMode: computed(() => appModeState.isArrangeMode)
    })
  }
})

vi.mock('@/renderer/extensions/linearMode/useOutputHistory', async () => {
  const { computed } = await import('vue')
  return {
    useOutputHistory: () => ({
      allOutputs: () => [],
      isWorkflowActive: computed(() => outputHistoryState.isWorkflowActive),
      cancelActiveWorkflowJobs: spies.cancelActiveWorkflowJobs
    })
  }
})

vi.mock('@/platform/assets/composables/useMediaAssetActions', () => ({
  useMediaAssetActions: () => ({ deleteAssets: spies.deleteAssets })
}))

vi.mock('@/scripts/app', () => ({
  app: { rootGraph: { id: 'root' }, loadGraphData: vi.fn() }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { download: 'Download' },
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
        Popover: { template: '<div data-testid="output-popover" />' },
        OutputHistory: outputHistoryStub
      }
    }
  })
  return { ...result, user }
}

describe('LinearPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    appModeState.isBuilderMode = false
    appModeState.isArrangeMode = false
    outputHistoryState.isWorkflowActive = false
  })

  it('renders the welcome screen and output history when idle', () => {
    renderPreview()

    expect(screen.getByTestId('linear-welcome')).toBeInTheDocument()
    expect(screen.getByTestId('output-history')).toBeInTheDocument()
  })

  it('hides the output history in builder mode', () => {
    appModeState.isBuilderMode = true

    renderPreview()

    expect(screen.queryByTestId('output-history')).not.toBeInTheDocument()
  })

  it('shows the arrange view in arrange mode', () => {
    appModeState.isArrangeMode = true

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
    const asset: AssetItem = { id: 'a1', name: 'out.png', tags: [] }
    const selection: OutputSelection = {
      asset,
      canShowPreview: true,
      latentPreviewUrl: 'blob:preview'
    }

    renderPreview({}, selection)

    expect(await screen.findByTestId('linear-output-info')).toBeInTheDocument()
    expect(screen.getByTestId('image-preview')).toBeInTheDocument()
    expect(screen.getByTestId('output-popover')).toBeInTheDocument()
    expect(screen.getByText('Rerun')).toBeInTheDocument()
    expect(screen.getByText('Reuse Parameters')).toBeInTheDocument()
  })
})
