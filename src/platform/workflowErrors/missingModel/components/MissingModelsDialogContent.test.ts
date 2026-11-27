import { getActivePinia } from 'pinia'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive } from 'vue'
import { createI18n } from 'vue-i18n'

import Dialog from '@comfyorg/design-system/dialog/Dialog'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { ModelWithUrl } from '@/platform/workflowErrors/missingModel/missingModelDownload'
import type { MissingModelDownloadState } from '@/platform/workflowErrors/missingModel/missingModelDownloadStore'
import { useMissingModelDownloadStore } from '@/platform/workflowErrors/missingModel/missingModelDownloadStore'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import type { MissingModelGroup } from '@/platform/workflowErrors/missingModel/types'

let downloadStates: Record<string, MissingModelDownloadState> = {}

vi.mock(
  import('@/platform/distribution/types'),
  () =>
    ({
      DISTRIBUTION: 'localhost',
      isCloud: false,
      isDesktop: false,
      isNightly: false
    }) as const
)

const focusNode = vi.hoisted(() => vi.fn(async () => {}))
vi.mock<unknown>(import('@/composables/canvas/useFocusNode'), () => ({
  useFocusNode: () => ({ focusNode })
}))

const executeCommand = vi.hoisted(() => vi.fn(async () => {}))
vi.mock<unknown>(import('@/platform/keybindings/commandStore'), () => ({
  useCommandStore: () => ({ execute: executeCommand })
}))

vi.mock<unknown>(import('./MissingModelRow.vue'), () => ({
  default: {
    name: 'MissingModelRow',
    template: `
      <div data-testid="model-row" :data-model-name="model.name">
        <button @click="$emit('locate-model', model.representative.nodeId)">
          Locate {{ model.name }}
        </button>
      </div>
    `,
    props: ['model', 'directory', 'isAssetSupported'],
    emits: ['locate-model']
  }
}))

import MissingModelsDialogContent from './MissingModelsDialogContent.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages },
  missingWarn: false,
  fallbackWarn: false
})

const MODELS = [
  { name: 'flux1-dev.safetensors', nodeId: '4', size: 2_000_000_000 },
  { name: 'ae.safetensors', nodeId: '7', size: 500_000_000 }
]

function urlOf(name: string) {
  return `https://huggingface.co/comfy/test/resolve/main/${name}`
}

function missingModelGroups(): MissingModelGroup[] {
  return [
    {
      directory: 'checkpoints',
      isAssetSupported: false,
      models: MODELS.map(({ name, nodeId }) => ({
        name,
        representative: {
          name,
          nodeId,
          nodeType: 'CheckpointLoaderSimple',
          widgetName: 'ckpt_name',
          isAssetSupported: false,
          isMissing: true,
          url: urlOf(name),
          directory: 'checkpoints'
        },
        referencingNodes: [{ nodeId, widgetName: 'ckpt_name' }]
      }))
    }
  ]
}

function setStates(states: Record<string, MissingModelDownloadState>) {
  downloadStates = reactive(states)
}

function renderDialog() {
  const onClose = vi.fn()
  const onNotNow = vi.fn()
  const InOpenDialog = defineComponent(
    () => () =>
      h(Dialog, { open: true }, () =>
        h(MissingModelsDialogContent, {
          missingModelGroups: missingModelGroups(),
          onClose,
          onNotNow
        })
      )
  )
  render(InOpenDialog, { global: { plugins: [getActivePinia()!, i18n] } })
  return { onClose, onNotNow }
}

describe('MissingModelsDialogContent', () => {
  beforeEach(() => {
    setStates({})
    const downloadStore = useMissingModelDownloadStore()
    vi.mocked(downloadStore.stateFor).mockImplementation(
      (model: ModelWithUrl) => downloadStates[model.name] ?? { status: 'idle' }
    )
    vi.mocked(downloadStore.download).mockImplementation(() => {})
    useMissingModelStore().fileSizes = Object.fromEntries(
      MODELS.map(({ name, size }) => [urlOf(name), size])
    )
  })

  it('offers every missing model with the total size in one download', async () => {
    renderDialog()

    expect(
      screen.getByRole('heading', { name: 'This workflow needs 2 models' })
    ).toBeInTheDocument()
    expect(screen.getAllByTestId('model-row')).toHaveLength(2)

    await userEvent.click(
      screen.getByRole('button', { name: /Download all \(2\.3\d* GB\)/ })
    )

    expect(
      vi
        .mocked(useMissingModelDownloadStore().download)
        .mock.calls.map(([model]) => model.name)
    ).toEqual(MODELS.map(({ name }) => name))
  })

  it('leaves for later with Not now', async () => {
    const { onNotNow } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(onNotNow).toHaveBeenCalledOnce()
  })

  it('shows how much has arrived while downloading and lets the user keep working', async () => {
    setStates({
      'flux1-dev.safetensors': { status: 'done' },
      'ae.safetensors': {
        status: 'downloading',
        paused: false,
        receivedBytes: 250_000_000,
        totalBytes: 500_000_000,
        fraction: 0.5
      }
    })
    const { onClose } = renderDialog()

    expect(
      screen.getByRole('heading', { name: 'Downloading 2 models' })
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('missing-models-dialog-progress')
    ).toHaveTextContent(/of 2\.3\d* GB/)

    await userEvent.click(screen.getByRole('button', { name: 'Keep working' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('runs the workflow once every model is downloaded', async () => {
    setStates({
      'flux1-dev.safetensors': { status: 'done' },
      'ae.safetensors': { status: 'done' }
    })
    const { onClose } = renderDialog()

    expect(
      screen.getByRole('heading', { name: 'Models ready' })
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Run workflow' }))

    expect(executeCommand).toHaveBeenCalledExactlyOnceWith('Comfy.QueuePrompt')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('says a download failed and retries it', async () => {
    setStates({
      'flux1-dev.safetensors': { status: 'done' },
      'ae.safetensors': { status: 'failed' }
    })
    renderDialog()

    expect(
      screen.getByRole('heading', { name: "Some models didn't download" })
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Check your connection, then retry.'
    )

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(useMissingModelDownloadStore().download).toHaveBeenCalled()
  })

  it('closes and shows the node when a row is located', async () => {
    const { onClose } = renderDialog()

    await userEvent.click(
      screen.getByRole('button', { name: 'Locate ae.safetensors' })
    )

    expect(onClose).toHaveBeenCalledOnce()
    expect(focusNode).toHaveBeenCalledExactlyOnceWith('7')
  })
})
