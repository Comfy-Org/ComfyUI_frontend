import { DownloadStatus } from '@comfyorg/comfyui-electron-types'
import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useElectronDownloadStore } from '@/platform/electronDownload/electronDownloadStore'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import type { MissingModelViewModel } from '@/platform/missingModel/types'
import type * as MissingModelDownload from '@/platform/missingModel/missingModelDownload'

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false,
  isDesktop: false
}))

vi.mock('@/utils/envUtil', () => ({
  electronAPI: () => ({ DownloadManager: undefined })
}))

const fetchModelMetadata = vi.hoisted(() => vi.fn())
const downloadModel = vi.hoisted(() => vi.fn())

vi.mock('@/platform/missingModel/missingModelDownload', async () => {
  const actual = await vi.importActual<typeof MissingModelDownload>(
    '@/platform/missingModel/missingModelDownload'
  )

  return {
    ...actual,
    downloadModel,
    fetchModelMetadata
  }
})

vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({ copyToClipboard: vi.fn() })
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
      template: '<div data-testid="missing-model-status-card" />'
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
      template: '<div data-testid="missing-model-library-select" />'
    }
  })
)

vi.mock(
  '@/platform/electronDownload/components/ElectronDownloadProgress.vue',
  () => ({
    default: {
      name: 'ElectronDownloadProgress',
      props: ['download', 'fileSize'],
      template:
        '<div data-testid="electron-download-progress" :data-file-size="fileSize">{{ download.filename }}</div>'
    }
  })
)

vi.mock(
  '@/platform/electronDownload/components/ElectronDownloadStoppedNotice.vue',
  () => ({
    default: {
      name: 'ElectronDownloadStoppedNotice',
      template: '<div data-testid="electron-download-stopped-notice" />'
    }
  })
)

const confirmLibrarySelect = vi.hoisted(() => vi.fn())

vi.mock(
  '@/platform/missingModel/composables/useMissingModelInteractions',
  () => ({
    getComboValue: vi.fn(() => 'missing-model.safetensors'),
    getModelStateKey: vi.fn(
      (name: string, directory: string | null, isAssetSupported: boolean) =>
        `${isAssetSupported ? 'supported' : 'unsupported'}::${directory ?? 'unknown'}::${name}`
    ),
    getNodeDisplayLabel: vi.fn(() => 'Checkpoint Loader'),
    useMissingModelInteractions: () => ({
      toggleModelExpand: vi.fn(),
      isModelExpanded: vi.fn(() => false),
      getComboOptions: vi.fn(() => []),
      handleComboSelect: vi.fn(),
      isSelectionConfirmable: vi.fn(() => false),
      cancelLibrarySelect: vi.fn(),
      confirmLibrarySelect,
      getTypeMismatch: vi.fn(() => null),
      getDownloadStatus: vi.fn(() => null)
    })
  })
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { download: 'Download', downloadWithSize: 'Download ({size})' },
      rightSidePanel: {
        missingModels: {
          collapseNodes: 'Collapse nodes',
          confirmSelection: 'Confirm selection',
          copyModelName: 'Copy model name',
          copyUrl: 'Copy URL',
          expandNodes: 'Expand nodes',
          locateNode: 'Locate node',
          refresh: 'Refresh'
        }
      }
    }
  },
  missingWarn: false,
  fallbackWarn: false
})

const MODEL_URL = 'https://civitai.com/api/download/models/1'

function makeModel(): MissingModelViewModel {
  return {
    name: 'wan_2.1_vae.safetensors',
    representative: {
      name: 'wan_2.1_vae.safetensors',
      nodeId: '1',
      nodeType: 'VAELoader',
      widgetName: 'vae_name',
      isAssetSupported: false,
      isMissing: true,
      url: MODEL_URL,
      directory: 'vae'
    },
    referencingNodes: [{ nodeId: '1', widgetName: 'vae_name' }]
  }
}

async function renderRow(
  opts: {
    status?: DownloadStatus
    fileSize?: number
    onRefreshMissingModels?: () => void
  } = {}
) {
  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
  const missingModelStore = useMissingModelStore()
  const electronDownloadStore = useElectronDownloadStore()

  if (opts.fileSize !== undefined) {
    missingModelStore.fileSizes[MODEL_URL] = opts.fileSize
  }

  if (opts.status !== undefined) {
    electronDownloadStore.downloads.push({
      url: MODEL_URL,
      filename: 'wan_2.1_vae.safetensors',
      savePath: '/models/vae/wan_2.1_vae.safetensors',
      progress: opts.status === DownloadStatus.COMPLETED ? 1 : 0.25,
      status: opts.status
    })
  }

  const { default: MissingModelRow } = await import('./MissingModelRow.vue')

  return render(MissingModelRow, {
    props: {
      model: makeModel(),
      directory: 'vae',
      showNodeIdBadge: false,
      isAssetSupported: false,
      ...(opts.onRefreshMissingModels
        ? { onRefreshMissingModels: opts.onRefreshMissingModels }
        : {})
    },
    global: {
      plugins: [pinia, PrimeVue, i18n]
    }
  })
}

describe('MissingModelRow', () => {
  beforeEach(() => {
    fetchModelMetadata.mockReset().mockResolvedValue({
      fileSize: null,
      gatedRepoUrl: null
    })
    downloadModel.mockReset()
    confirmLibrarySelect.mockReset()
  })

  it('passes the known model size to the active electron download progress card', async () => {
    await renderRow({
      status: DownloadStatus.IN_PROGRESS,
      fileSize: 242 * 1024 * 1024
    })

    expect(screen.getByTestId('electron-download-progress')).toHaveAttribute(
      'data-file-size',
      String(242 * 1024 * 1024)
    )
  })

  it('uses the header action to refresh missing models after the electron download completes', async () => {
    const user = userEvent.setup()
    const onRefreshMissingModels = vi.fn()
    await renderRow({
      status: DownloadStatus.COMPLETED,
      onRefreshMissingModels
    })

    await user.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(onRefreshMissingModels).toHaveBeenCalledTimes(1)
    expect(confirmLibrarySelect).not.toHaveBeenCalled()
  })
})
