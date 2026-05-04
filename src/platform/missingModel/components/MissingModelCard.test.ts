import { createTestingPinia } from '@pinia/testing'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type {
  MissingModelGroup,
  MissingModelViewModel
} from '@/platform/missingModel/types'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'

vi.mock('./MissingModelRow.vue', () => ({
  default: {
    name: 'MissingModelRow',
    template:
      '<div class="model-row" :data-show-node-id-badge="showNodeIdBadge" :data-is-asset-supported="isAssetSupported" :data-directory="directory"><button class="locate-trigger" @click="$emit(\'locate-model\', model?.representative?.nodeId)">Locate</button></div>',
    props: ['model', 'directory', 'showNodeIdBadge', 'isAssetSupported'],
    emits: ['locate-model']
  }
}))

const mockDownloadModel = vi.hoisted(() => vi.fn())
const mockIsCloud = vi.hoisted(() => ({ value: true }))
const mockIsDesktop = vi.hoisted(() => ({ value: false }))
vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  },
  get isDesktop() {
    return mockIsDesktop.value
  }
}))

vi.mock('@/platform/missingModel/missingModelDownload', () => ({
  downloadModel: (...args: unknown[]) => mockDownloadModel(...args),
  isModelDownloadable: () => true
}))

import MissingModelCard from './MissingModelCard.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      rightSidePanel: {
        missingModels: {
          importNotSupported: 'Import Not Supported',
          customNodeDownloadDisabled:
            'Cloud environment does not support model imports for custom nodes.',
          unknownCategory: 'Unknown Category',
          downloadAll: 'Download all',
          refresh: 'Refresh',
          refreshing: 'Refreshing missing models.'
        }
      }
    }
  },
  missingWarn: false,
  fallbackWarn: false
})

function makeViewModel(
  name: string,
  nodeId: string = '1',
  opts: {
    url?: string
    directory?: string
  } = {}
): MissingModelViewModel {
  return {
    name,
    representative: {
      name,
      nodeId,
      nodeType: 'CheckpointLoaderSimple',
      widgetName: 'ckpt_name',
      isAssetSupported: true,
      isMissing: true,
      url: opts.url,
      directory: opts.directory
    },
    referencingNodes: [{ nodeId, widgetName: 'ckpt_name' }]
  }
}

function makeGroup(
  opts: {
    directory?: string | null
    isAssetSupported?: boolean
    modelNames?: string[]
    withDownloadUrls?: boolean
  } = {}
): MissingModelGroup {
  const names = opts.modelNames ?? ['model.safetensors']
  const directory =
    'directory' in opts ? (opts.directory ?? null) : 'checkpoints'
  return {
    directory,
    isAssetSupported: opts.isAssetSupported ?? true,
    models: names.map((n, i) =>
      makeViewModel(n, String(i + 1), {
        url: opts.withDownloadUrls
          ? `https://huggingface.co/comfy/test/resolve/main/${n}`
          : undefined,
        directory: directory ?? undefined
      })
    )
  }
}

function mountCard(
  props: Partial<{
    missingModelGroups: MissingModelGroup[]
    showNodeIdBadge: boolean
  }> = {},
  onLocateModel?: (nodeId: string) => void
) {
  const pinia = createTestingPinia({ createSpy: vi.fn })
  return render(MissingModelCard, {
    props: {
      missingModelGroups: [makeGroup()],
      showNodeIdBadge: false,
      ...props,
      ...(onLocateModel ? { onLocateModel } : {})
    },
    global: {
      plugins: [pinia, PrimeVue, i18n]
    }
  })
}

describe('MissingModelCard', () => {
  beforeEach(() => {
    mockIsCloud.value = true
    mockIsDesktop.value = false
    mockDownloadModel.mockReset()
    mockDownloadModel.mockResolvedValue(true)
  })

  describe('Rendering & Props', () => {
    it('renders directory name in category header', () => {
      const { container } = mountCard({
        missingModelGroups: [makeGroup({ directory: 'loras' })]
      })
      expect(container.textContent).toContain('loras')
    })

    it('renders translated unknown category when directory is null', () => {
      const { container } = mountCard({
        missingModelGroups: [makeGroup({ directory: null })]
      })
      expect(container.textContent).toContain('Unknown Category')
    })

    it('renders model count in category header', () => {
      const { container } = mountCard({
        missingModelGroups: [
          makeGroup({ modelNames: ['a.safetensors', 'b.safetensors'] })
        ]
      })
      expect(container.textContent).toContain('(2)')
    })

    it('renders correct number of MissingModelRow components', () => {
      const { container } = mountCard({
        missingModelGroups: [
          makeGroup({
            modelNames: ['a.safetensors', 'b.safetensors', 'c.safetensors']
          })
        ]
      })
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelectorAll('.model-row')).toHaveLength(3)
    })

    it('renders multiple groups', () => {
      const { container } = mountCard({
        missingModelGroups: [
          makeGroup({ directory: 'checkpoints' }),
          makeGroup({ directory: 'loras' })
        ]
      })
      expect(container.textContent).toContain('checkpoints')
      expect(container.textContent).toContain('loras')
    })

    it('renders zero rows when missingModelGroups is empty', () => {
      const { container } = mountCard({ missingModelGroups: [] })
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelectorAll('.model-row')).toHaveLength(0)
    })

    it('hides bulk actions in cloud', () => {
      mountCard({
        missingModelGroups: [makeGroup({ withDownloadUrls: true })]
      })

      expect(
        screen.queryByTestId('missing-model-actions')
      ).not.toBeInTheDocument()
    })

    it('passes props correctly to MissingModelRow children', () => {
      const { container } = mountCard({ showNodeIdBadge: true })
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const row = container.querySelector('.model-row')
      expect(row).not.toBeNull()
      expect(row!.getAttribute('data-show-node-id-badge')).toBe('true')
      expect(row!.getAttribute('data-is-asset-supported')).toBe('true')
      expect(row!.getAttribute('data-directory')).toBe('checkpoints')
    })
  })

  describe('Asset Unsupported Group', () => {
    it('shows "Import Not Supported" header for unsupported groups', () => {
      const { container } = mountCard({
        missingModelGroups: [makeGroup({ isAssetSupported: false })]
      })
      expect(container.textContent).toContain('Import Not Supported')
    })

    it('shows info notice for unsupported groups', () => {
      const { container } = mountCard({
        missingModelGroups: [makeGroup({ isAssetSupported: false })]
      })
      expect(container.textContent).toContain(
        'Cloud environment does not support model imports'
      )
    })

    it('hides info notice for supported groups', () => {
      const { container } = mountCard({
        missingModelGroups: [makeGroup({ isAssetSupported: true })]
      })
      expect(container.textContent).not.toContain(
        'Cloud environment does not support model imports'
      )
    })
  })

  describe('Event Handling', () => {
    it('emits locateModel when child emits locate-model', async () => {
      const onLocateModel = vi.fn()
      mountCard({}, onLocateModel)
      const locateButton = screen.getByRole('button', { name: 'Locate' })
      await userEvent.click(locateButton)
      expect(onLocateModel).toHaveBeenCalledWith('1')
    })
  })
})

describe('MissingModelCard (OSS)', () => {
  beforeEach(() => {
    mockIsCloud.value = false
    mockIsDesktop.value = false
    mockDownloadModel.mockReset()
    mockDownloadModel.mockResolvedValue(true)
  })

  afterEach(() => {
    mockIsCloud.value = true
  })

  it('shows directory name instead of "Import Not Supported" for unsupported groups', () => {
    const { container } = mountCard({
      missingModelGroups: [
        makeGroup({ directory: 'checkpoints', isAssetSupported: false })
      ]
    })
    expect(container.textContent).toContain('checkpoints')
    expect(container.textContent).not.toContain('Import Not Supported')
  })

  it('hides info notice for unsupported groups', () => {
    const { container } = mountCard({
      missingModelGroups: [makeGroup({ isAssetSupported: false })]
    })
    expect(container.textContent).not.toContain(
      'Cloud environment does not support model imports'
    )
  })

  it('renders unknown category for null directory in OSS', () => {
    const { container } = mountCard({
      missingModelGroups: [
        makeGroup({ directory: null, isAssetSupported: false })
      ]
    })
    expect(container.textContent).toContain('Unknown Category')
    expect(container.textContent).not.toContain('Import Not Supported')
  })

  it('shows bulk actions when one model is downloadable', () => {
    mountCard({
      missingModelGroups: [makeGroup({ withDownloadUrls: true })]
    })

    expect(screen.getByRole('button', { name: /Download all/ })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeVisible()
  })

  it('hides bulk actions when no model is downloadable', () => {
    mountCard()

    expect(
      screen.queryByRole('button', { name: /Download all/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Refresh' })
    ).not.toBeInTheDocument()
  })

  it('refreshes missing models from the action bar', async () => {
    mountCard({
      missingModelGroups: [makeGroup({ withDownloadUrls: true })]
    })
    const store = useMissingModelStore()

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(store.refreshMissingModels).toHaveBeenCalled()
  })

  it('keeps the Refresh button focusable and announces refresh progress', async () => {
    mountCard({
      missingModelGroups: [makeGroup({ withDownloadUrls: true })]
    })
    const store = useMissingModelStore()

    store.isRefreshingMissingModels = true
    await nextTick()

    const refreshButton = screen.getByRole('button', { name: 'Refresh' })
    expect(refreshButton).toHaveAttribute('aria-disabled', 'true')
    expect(refreshButton).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Refreshing missing models.'
    )
  })

  it('tracks each successfully started desktop download from Download all', async () => {
    mockIsDesktop.value = true
    mockDownloadModel
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)

    mountCard({
      missingModelGroups: [
        makeGroup({
          isAssetSupported: false,
          withDownloadUrls: true,
          modelNames: ['a.safetensors', 'b.safetensors', 'c.safetensors']
        })
      ]
    })
    const store = useMissingModelStore()
    store.folderPaths = { checkpoints: ['/models/checkpoints'] }

    await userEvent.click(screen.getByRole('button', { name: /Download all/ }))

    await waitFor(() => expect(mockDownloadModel).toHaveBeenCalledTimes(3))
    expect(
      store.downloadRefs['unsupported::checkpoints::a.safetensors']
    ).toEqual({
      kind: 'electron-download',
      url: 'https://huggingface.co/comfy/test/resolve/main/a.safetensors'
    })
    expect(
      store.selectedLibraryModel['unsupported::checkpoints::a.safetensors']
    ).toBe('a.safetensors')
    expect(
      store.downloadRefs['unsupported::checkpoints::b.safetensors']
    ).toBeUndefined()
    expect(
      store.selectedLibraryModel['unsupported::checkpoints::b.safetensors']
    ).toBeUndefined()
    expect(
      store.downloadRefs['unsupported::checkpoints::c.safetensors']
    ).toEqual({
      kind: 'electron-download',
      url: 'https://huggingface.co/comfy/test/resolve/main/c.safetensors'
    })
    expect(
      store.selectedLibraryModel['unsupported::checkpoints::c.safetensors']
    ).toBe('c.safetensors')
  })

  it('does not create desktop tracking state for browser Download all starts', async () => {
    mountCard({
      missingModelGroups: [
        makeGroup({
          isAssetSupported: false,
          withDownloadUrls: true,
          modelNames: ['a.safetensors']
        })
      ]
    })
    const store = useMissingModelStore()

    await userEvent.click(screen.getByRole('button', { name: /Download all/ }))

    await waitFor(() => expect(mockDownloadModel).toHaveBeenCalledTimes(1))
    expect(
      store.downloadRefs['unsupported::checkpoints::a.safetensors']
    ).toBeUndefined()
    expect(
      store.selectedLibraryModel['unsupported::checkpoints::a.safetensors']
    ).toBeUndefined()
  })
})
