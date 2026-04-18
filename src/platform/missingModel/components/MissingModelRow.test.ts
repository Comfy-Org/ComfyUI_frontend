import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { MissingModelViewModel } from '@/platform/missingModel/types'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'

const mockDownloadModel = vi.hoisted(() => vi.fn())
const mockFetchModelMetadata = vi.hoisted(() => vi.fn())
const mockCopyToClipboard = vi.hoisted(() => vi.fn())

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: null
  }
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))

vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({
    copyToClipboard: mockCopyToClipboard
  })
}))

vi.mock('@/components/rightSidePanel/layout/TransitionCollapse.vue', () => ({
  default: {
    name: 'TransitionCollapse',
    template: '<div><slot /></div>'
  }
}))

vi.mock(
  '@/platform/missingModel/components/MissingModelStatusCard.vue',
  () => ({
    default: {
      name: 'MissingModelStatusCard',
      props: ['downloadStatus'],
      template:
        '<div data-testid="missing-model-status-card">{{ downloadStatus?.status ?? "none" }}</div>'
    }
  })
)

vi.mock('@/platform/missingModel/components/MissingModelUrlInput.vue', () => ({
  default: {
    name: 'MissingModelUrlInput',
    template: '<div data-testid="missing-model-url-input" />'
  }
}))

vi.mock(
  '@/platform/missingModel/components/MissingModelLibrarySelect.vue',
  () => ({
    default: {
      name: 'MissingModelLibrarySelect',
      emits: ['select'],
      template:
        '<button data-testid="missing-model-library-select" @click="$emit(\'select\', \'library-model.safetensors\')">Select</button>'
    }
  })
)

vi.mock(
  '@/platform/missingModel/composables/useMissingModelInteractions',
  () => ({
    getModelStateKey: (
      modelName: string,
      directory: string | null,
      isAssetSupported: boolean
    ) =>
      `${isAssetSupported ? 'supported' : 'unsupported'}::${directory ?? ''}::${modelName}`,
    getNodeDisplayLabel: (nodeId: string | number) => `Node ${nodeId}`,
    getComboValue: () => undefined,
    useMissingModelInteractions: () => {
      const store = useMissingModelStore()

      return {
        toggleModelExpand: vi.fn(),
        isModelExpanded: () => false,
        getComboOptions: () => [],
        handleComboSelect: (key: string, value: string | undefined) => {
          if (value) {
            store.selectedLibraryModel[key] = value
          }
        },
        isSelectionConfirmable: () => false,
        cancelLibrarySelect: vi.fn(),
        confirmLibrarySelect: vi.fn(),
        getTypeMismatch: () => null,
        getDownloadStatus: (key: string) =>
          store.downloadRefs[key]?.kind === 'electron-download'
            ? { progress: 0, status: 'created' as const }
            : null
      }
    }
  })
)

vi.mock('@/platform/missingModel/missingModelDownload', () => ({
  downloadModel: (...args: unknown[]) => mockDownloadModel(...args),
  fetchModelMetadata: (...args: unknown[]) => mockFetchModelMetadata(...args),
  isModelDownloadable: () => true,
  toBrowsableUrl: (url: string) => url
}))

import MissingModelRow from './MissingModelRow.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        download: 'Download'
      },
      rightSidePanel: {
        missingModels: {
          copyModelName: 'Copy model name',
          copyUrl: 'Copy URL',
          confirmSelection: 'Confirm selection',
          collapseNodes: 'Collapse nodes',
          expandNodes: 'Expand nodes'
        }
      }
    }
  },
  missingWarn: false,
  fallbackWarn: false
})

const model: MissingModelViewModel = {
  name: 'z_image_turbo_bf16.safetensors',
  representative: {
    name: 'z_image_turbo_bf16.safetensors',
    url: 'https://example.com/z_image_turbo_bf16.safetensors',
    directory: 'checkpoints',
    nodeId: '1',
    nodeType: 'CheckpointLoaderSimple',
    widgetName: 'ckpt_name',
    isAssetSupported: false,
    isMissing: true
  },
  referencingNodes: [{ nodeId: '1', widgetName: 'ckpt_name' }]
}

const modelKey = 'unsupported::checkpoints::z_image_turbo_bf16.safetensors'

function renderComponent() {
  return render(MissingModelRow, {
    props: {
      model,
      directory: 'checkpoints',
      showNodeIdBadge: false,
      isAssetSupported: false
    },
    global: {
      plugins: [i18n]
    }
  })
}

describe('MissingModelRow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockDownloadModel.mockReset()
    mockDownloadModel.mockResolvedValue(true)
    mockFetchModelMetadata.mockReset()
    mockFetchModelMetadata.mockResolvedValue({
      fileSize: null,
      gatedRepoUrl: null
    })
    mockCopyToClipboard.mockReset()

    const store = useMissingModelStore()
    store.folderPaths = {
      checkpoints: ['/models/checkpoints']
    }
  })

  it('tracks and surfaces direct Electron downloads immediately after the button is clicked', async () => {
    const user = userEvent.setup()
    const store = useMissingModelStore()
    renderComponent()

    await user.click(screen.getByTestId('missing-model-download'))

    expect(mockDownloadModel).toHaveBeenCalledWith(
      {
        name: model.representative.name,
        url: model.representative.url,
        directory: model.representative.directory
      },
      store.folderPaths
    )
    expect(store.downloadRefs[modelKey]).toEqual({
      kind: 'electron-download',
      url: model.representative.url
    })
    expect(store.selectedLibraryModel[modelKey]).toBe(model.representative.name)
    expect(screen.getByTestId('missing-model-status-card')).toHaveTextContent(
      'created'
    )
  })

  it('does not create UI state when the Electron download does not start', async () => {
    mockDownloadModel.mockResolvedValue(false)
    const user = userEvent.setup()
    const store = useMissingModelStore()
    renderComponent()

    await user.click(screen.getByTestId('missing-model-download'))

    expect(store.downloadRefs[modelKey]).toBeUndefined()
    expect(store.selectedLibraryModel[modelKey]).toBeUndefined()
    expect(
      screen.queryByTestId('missing-model-status-card')
    ).not.toBeInTheDocument()
  })

  it('clears stale download refs when the user picks a library alternative', async () => {
    const user = userEvent.setup()
    const store = useMissingModelStore()
    store.downloadRefs[modelKey] = {
      kind: 'electron-download',
      url: model.representative.url!
    }

    renderComponent()

    await user.click(screen.getByTestId('missing-model-library-select'))

    expect(store.downloadRefs[modelKey]).toBeUndefined()
    expect(store.selectedLibraryModel[modelKey]).toBe(
      'library-model.safetensors'
    )
  })
})
