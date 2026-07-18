import { createPinia, setActivePinia } from 'pinia'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type {
  UploadModelDialogContext,
  UploadModelSuccess
} from '@/platform/assets/composables/useUploadModelWizard'
import type { MissingModelViewModel } from '@/platform/missingModel/types'
import type * as MissingModelDownload from '@/platform/missingModel/missingModelDownload'
import type * as GraphTraversalUtil from '@/utils/graphTraversalUtil'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'

const mockIsCloud = vi.hoisted(() => ({ value: true }))
const mockShowUploadDialog = vi.hoisted(() => vi.fn())
const mockCopyToClipboard = vi.hoisted(() => vi.fn())
const mockDownloadModel = vi.hoisted(() => vi.fn())
const mockRootGraph = vi.hoisted<{
  value: Record<string, never> | null
}>(() => ({ value: null }))
const mockGetNodeByExecutionId = vi.hoisted(() => vi.fn())
const mockApiListeners = vi.hoisted(
  () => new Map<string, (event: CustomEvent) => void>()
)
type UploadModelContextResolver = () => UploadModelDialogContext | undefined
const mockUploadContext = vi.hoisted(() => ({
  resolver: undefined as UploadModelContextResolver | undefined
}))
const mockUploadCallbacks = vi.hoisted(() => ({
  onUploadSuccess: undefined as
    | ((result: UploadModelSuccess) => Promise<unknown> | unknown)
    | undefined
}))

vi.mock('@/scripts/app', () => ({
  app: {
    get rootGraph() {
      return mockRootGraph.value
    }
  }
}))

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn(
      (event: string, handler: (event: CustomEvent) => void) => {
        mockApiListeners.set(event, handler)
      }
    ),
    apiURL: vi.fn((path: string) => path),
    fetchApi: vi.fn()
  }
}))

vi.mock('@/utils/graphTraversalUtil', async () => {
  const actual = await vi.importActual<typeof GraphTraversalUtil>(
    '@/utils/graphTraversalUtil'
  )
  return {
    ...actual,
    getActiveGraphNodeIds: vi.fn(() => new Set()),
    getNodeByExecutionId: mockGetNodeByExecutionId
  }
})

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock('@/platform/assets/composables/useModelUpload', () => ({
  useModelUpload: (
    onUploadSuccess?: (
      result: UploadModelSuccess
    ) => Promise<unknown> | unknown,
    uploadContext?: UploadModelDialogContext | UploadModelContextResolver
  ) => {
    mockUploadCallbacks.onUploadSuccess = onUploadSuccess
    mockUploadContext.resolver =
      typeof uploadContext === 'function' ? uploadContext : () => uploadContext

    return {
      isUploadButtonEnabled: { value: true },
      showUploadDialog: mockShowUploadDialog
    }
  }
}))

vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({
    copyToClipboard: mockCopyToClipboard
  })
}))

vi.mock('@/platform/missingModel/missingModelDownload', async () => {
  const actual = await vi.importActual<typeof MissingModelDownload>(
    '@/platform/missingModel/missingModelDownload'
  )
  return {
    ...actual,
    downloadModel: mockDownloadModel,
    fetchModelMetadata: vi.fn().mockResolvedValue({
      fileSize: null,
      gatedRepoUrl: null
    })
  }
})

import MissingModelRow from './MissingModelRow.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages },
  missingWarn: false,
  fallbackWarn: false
})

const TransitionCollapseStub = {
  name: 'TransitionCollapse',
  template: '<div><slot /></div>'
}

function makeModel(
  refs: MissingModelViewModel['referencingNodes']
): MissingModelViewModel {
  return {
    name: 'model.safetensors',
    representative: {
      nodeId: refs[0]?.nodeId,
      nodeType: 'CheckpointLoaderSimple',
      widgetName: 'ckpt_name',
      isAssetSupported: true,
      name: 'model.safetensors',
      directory: 'checkpoints',
      url: 'https://example.com/model.safetensors',
      isMissing: true
    },
    referencingNodes: refs
  }
}

function renderRow(
  model: MissingModelViewModel,
  onLocateModel = vi.fn(),
  isAssetSupported = true,
  directory: string | null = 'checkpoints',
  canCloudImport = true
) {
  const pinia = createPinia()
  setActivePinia(pinia)

  render(MissingModelRow, {
    props: {
      model,
      directory,
      isAssetSupported,
      canCloudImport,
      onLocateModel
    },
    global: {
      plugins: [pinia, i18n],
      stubs: {
        TransitionCollapse: TransitionCollapseStub
      }
    }
  })

  return { onLocateModel }
}

describe('MissingModelRow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsCloud.value = true
    mockRootGraph.value = null
    mockApiListeners.clear()
    mockGetNodeByExecutionId.mockReset()
    mockUploadContext.resolver = undefined
    mockUploadCallbacks.onUploadSuccess = undefined
  })

  it('opens the model import dialog from the cloud row', async () => {
    const user = userEvent.setup()
    renderRow(makeModel([{ nodeId: '1', widgetName: 'ckpt_name' }]))

    await user.click(screen.getByRole('button', { name: 'Import' }))

    expect(mockShowUploadDialog).toHaveBeenCalledTimes(1)
    expect(mockUploadContext.resolver?.()).toEqual({
      kind: 'missing-model-resolution',
      missingModelName: 'model.safetensors',
      requiredModelType: 'checkpoints',
      replacementTargets: [
        {
          nodeId: '1',
          nodeLabel: 'CheckpointLoaderSimple',
          widgetName: 'ckpt_name'
        }
      ]
    })
  })

  it('keeps unsupported cloud rows as reference-only rows', () => {
    renderRow(
      makeModel([{ nodeId: '1', widgetName: 'model_name' }]),
      vi.fn(),
      true,
      null,
      false
    )

    expect(screen.getByText('model.safetensors')).toBeInTheDocument()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'CheckpointLoaderSimple' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Import' })).toBeNull()
  })

  it('shows row progress as soon as the model import starts', async () => {
    renderRow(makeModel([{ nodeId: '1', widgetName: 'ckpt_name' }]))
    const store = useMissingModelStore()

    await mockUploadCallbacks.onUploadSuccess?.({
      filename: 'downloaded-model.safetensors',
      modelType: 'checkpoints',
      taskId: 'task-1',
      status: 'processing'
    })
    await nextTick()

    expect(
      store.importTaskIds['supported::checkpoints::model.safetensors']
    ).toBe('task-1')
    expect(
      screen.getByRole('progressbar', { name: 'Importing...' })
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Importing...')
    expect(screen.getByText('downloaded-model.safetensors')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Import' })).toBeNull()
  })

  it('applies the completed imported model to every referencing node', async () => {
    const graph = {}
    const firstWidget = {
      name: 'ckpt_name',
      value: 'old-first.safetensors',
      callback: vi.fn()
    }
    const secondWidget = {
      name: 'ckpt_name',
      value: 'old-second.safetensors',
      callback: vi.fn()
    }
    const firstSetDirtyCanvas = vi.fn()
    const secondSetDirtyCanvas = vi.fn()
    mockRootGraph.value = graph
    mockGetNodeByExecutionId.mockImplementation((_graph, nodeId) => {
      if (nodeId === '1') {
        return {
          widgets: [firstWidget],
          graph: { setDirtyCanvas: firstSetDirtyCanvas }
        }
      }
      if (nodeId === '2') {
        return {
          widgets: [secondWidget],
          graph: { setDirtyCanvas: secondSetDirtyCanvas }
        }
      }
      return null
    })

    renderRow(
      makeModel([
        { nodeId: '1', widgetName: 'ckpt_name' },
        { nodeId: '2', widgetName: 'ckpt_name' }
      ])
    )

    await mockUploadCallbacks.onUploadSuccess?.({
      filename: 'client-name.safetensors',
      modelType: 'checkpoints',
      taskId: 'task-1',
      status: 'processing'
    })
    await nextTick()

    const handler = mockApiListeners.get('asset_download')
    expect(handler).toBeDefined()
    handler!(
      new CustomEvent('asset_download', {
        detail: {
          task_id: 'task-1',
          asset_name: 'server-name.safetensors',
          bytes_total: 100,
          bytes_downloaded: 100,
          progress: 1,
          status: 'completed'
        }
      })
    )

    await waitFor(() => {
      expect(firstWidget.value).toBe('server-name.safetensors')
      expect(secondWidget.value).toBe('server-name.safetensors')
    })
    expect(firstWidget.callback).toHaveBeenCalledWith('server-name.safetensors')
    expect(secondWidget.callback).toHaveBeenCalledWith(
      'server-name.safetensors'
    )
    expect(firstSetDirtyCanvas).toHaveBeenCalledWith(true, true)
    expect(secondSetDirtyCanvas).toHaveBeenCalledWith(true, true)
  })

  it('locates the parent row directly when a cloud model has one reference', async () => {
    const user = userEvent.setup()
    const { onLocateModel } = renderRow(
      makeModel([{ nodeId: '1', widgetName: 'ckpt_name' }])
    )

    await user.click(screen.getByRole('button', { name: 'model.safetensors' }))

    expect(onLocateModel).toHaveBeenCalledWith('1')
  })

  it('gives the header locate button a node-specific accessible name', async () => {
    const user = userEvent.setup()
    const { onLocateModel } = renderRow(
      makeModel([{ nodeId: '1', widgetName: 'ckpt_name' }])
    )

    const locateButton = screen.getByRole('button', {
      name: 'Locate CheckpointLoaderSimple'
    })
    expect(locateButton).toBeInTheDocument()

    await user.click(locateButton)
    expect(onLocateModel).toHaveBeenCalledWith('1')
  })

  it('moves locate actions to expanded child rows when a cloud model has multiple references', async () => {
    const user = userEvent.setup()
    const { onLocateModel } = renderRow(
      makeModel([
        { nodeId: '1', widgetName: 'ckpt_name' },
        { nodeId: '2', widgetName: 'ckpt_name' }
      ])
    )

    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.queryAllByTestId('missing-model-locate')).toHaveLength(0)

    await user.click(
      screen.getByRole('button', { name: 'Show referencing nodes' })
    )

    const locateButtons = screen.getAllByTestId('missing-model-locate')
    expect(locateButtons).toHaveLength(2)

    await user.click(locateButtons[1])

    expect(onLocateModel).toHaveBeenCalledWith('2')
  })

  it('locates the parent row directly when an OSS model has one reference', async () => {
    mockIsCloud.value = false
    const user = userEvent.setup()
    const { onLocateModel } = renderRow(
      makeModel([{ nodeId: '1', widgetName: 'ckpt_name' }])
    )

    await user.click(screen.getByRole('button', { name: 'model.safetensors' }))

    expect(onLocateModel).toHaveBeenCalledWith('1')
  })

  it('shows no resolution action in OSS rows without a download url', () => {
    mockIsCloud.value = false

    renderRow(makeModel([{ nodeId: '1', widgetName: 'ckpt_name' }]))

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('missing-model-download')
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('missing-model-import')).not.toBeInTheDocument()
  })

  it('shows model type metadata below the model name', () => {
    renderRow(makeModel([{ nodeId: '1', widgetName: 'ckpt_name' }]))

    expect(screen.getByText('checkpoints')).toBeInTheDocument()
  })

  it('shows downloadable model size beside the model type metadata', async () => {
    mockIsCloud.value = false
    const model = makeModel([{ nodeId: '1', widgetName: 'ckpt_name' }])
    model.representative.url =
      'https://huggingface.co/comfy/test/resolve/main/model.safetensors'

    renderRow(model, vi.fn(), false)
    const store = useMissingModelStore()
    store.fileSizes[model.representative.url] = 14 * 1024 ** 3
    await nextTick()

    expect(screen.getByText('checkpoints · 14 GB')).toBeInTheDocument()
    expect(screen.getByTestId('missing-model-download')).toHaveTextContent(
      'Download'
    )
  })

  it('shows unknown category metadata for models without a directory', () => {
    renderRow(
      makeModel([{ nodeId: '1', widgetName: 'ckpt_name' }]),
      vi.fn(),
      true,
      null
    )

    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('moves locate actions to expanded child rows when an OSS model has multiple references', async () => {
    mockIsCloud.value = false
    const user = userEvent.setup()
    const { onLocateModel } = renderRow(
      makeModel([
        { nodeId: '1', widgetName: 'ckpt_name' },
        { nodeId: '2', widgetName: 'ckpt_name' }
      ])
    )

    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.queryAllByTestId('missing-model-locate')).toHaveLength(0)

    await user.click(
      screen.getByRole('button', { name: 'Show referencing nodes' })
    )

    const locateButtons = screen.getAllByTestId('missing-model-locate')
    expect(locateButtons).toHaveLength(2)

    await user.click(locateButtons[1])

    expect(onLocateModel).toHaveBeenCalledWith('2')
  })

  it('shows the OSS download action in the row for downloadable models', async () => {
    mockIsCloud.value = false
    const user = userEvent.setup()
    const model = makeModel([{ nodeId: '1', widgetName: 'ckpt_name' }])
    model.representative.url =
      'https://huggingface.co/comfy/test/resolve/main/model.safetensors'

    renderRow(model, vi.fn(), false)

    await user.click(screen.getByTestId('missing-model-download'))

    expect(mockDownloadModel).toHaveBeenCalledWith(
      {
        name: 'model.safetensors',
        url: 'https://huggingface.co/comfy/test/resolve/main/model.safetensors',
        directory: 'checkpoints'
      },
      {}
    )
  })
})
