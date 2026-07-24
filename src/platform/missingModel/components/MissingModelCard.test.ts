import { createTestingPinia } from '@pinia/testing'
import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type {
  MissingModelGroup,
  MissingModelViewModel
} from '@/platform/missingModel/types'
import type * as MissingModelDownload from '@/platform/missingModel/missingModelDownload'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'

const mockDownloadModel = vi.hoisted(() => vi.fn())

vi.mock('@/platform/missingModel/missingModelDownload', async () => {
  const actual = await vi.importActual<typeof MissingModelDownload>(
    '@/platform/missingModel/missingModelDownload'
  )
  return {
    ...actual,
    downloadModel: mockDownloadModel
  }
})

vi.mock('./MissingModelRow.vue', () => ({
  default: {
    name: 'MissingModelRow',
    template: `
      <div
        data-testid="model-row"
        class="model-row"
        :data-model-name="model.name"
        :data-is-asset-supported="isAssetSupported"
        :data-directory="directory"
        :data-can-cloud-import="canCloudImport"
      >
        <button
          class="locate-trigger"
          @click="$emit('locate-model', model?.representative?.nodeId)"
        >
          Locate
        </button>
      </div>
    `,
    props: ['model', 'directory', 'isAssetSupported', 'canCloudImport'],
    emits: ['locate-model']
  }
}))

const mockIsCloud = vi.hoisted(() => ({ value: true }))
vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

import MissingModelCard from './MissingModelCard.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages },
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
  }> = {},
  onLocateModel?: (nodeId: string) => void
) {
  const pinia = createTestingPinia({ createSpy: vi.fn })
  return render(MissingModelCard, {
    props: {
      missingModelGroups: [makeGroup()],
      ...props,
      ...(onLocateModel ? { onLocateModel } : {})
    },
    global: {
      plugins: [pinia, PrimeVue, i18n]
    }
  })
}

function getRows() {
  return screen.queryAllByTestId('model-row')
}

function getRowsIn(testId: string) {
  return within(screen.getByTestId(testId)).getAllByTestId('model-row')
}

describe('MissingModelCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsCloud.value = true
  })

  describe('Rendering & Props', () => {
    it('passes the model directory to rows', () => {
      mockIsCloud.value = false
      mountCard({
        missingModelGroups: [makeGroup({ directory: 'loras' })]
      })
      expect(getRows()[0].getAttribute('data-directory')).toBe('loras')
    })

    it('renders correct number of MissingModelRow components', () => {
      mountCard({
        missingModelGroups: [
          makeGroup({
            modelNames: ['a.safetensors', 'b.safetensors', 'c.safetensors']
          })
        ]
      })
      expect(getRows()).toHaveLength(3)
    })

    it('flattens multiple groups into rows', () => {
      mockIsCloud.value = false
      mountCard({
        missingModelGroups: [
          makeGroup({ directory: 'checkpoints' }),
          makeGroup({ directory: 'loras' })
        ]
      })
      expect(getRows()).toHaveLength(2)
    })

    it('sorts importable rows by model type order in cloud', () => {
      mountCard({
        missingModelGroups: [
          makeGroup({ directory: null, modelNames: ['unknown.safetensors'] }),
          makeGroup({ directory: 'loras', modelNames: ['lora.safetensors'] }),
          makeGroup({
            directory: 'checkpoints',
            modelNames: ['checkpoint.safetensors']
          })
        ]
      })

      expect(
        getRowsIn('missing-model-importable-rows').map((row) =>
          row.getAttribute('data-model-name')
        )
      ).toEqual(['checkpoint.safetensors', 'lora.safetensors'])
    })

    it('moves cloud rows without import context into the unsupported section', () => {
      mountCard({
        missingModelGroups: [
          makeGroup({
            directory: 'checkpoints',
            modelNames: ['importable.safetensors']
          }),
          makeGroup({
            directory: null,
            modelNames: ['unknown.safetensors']
          }),
          makeGroup({
            directory: 'loras',
            isAssetSupported: false,
            modelNames: ['custom-node-model.safetensors']
          })
        ]
      })

      expect(
        getRowsIn('missing-model-importable-rows').map((row) =>
          row.getAttribute('data-model-name')
        )
      ).toEqual(['importable.safetensors'])

      const unsupportedSection = screen.getByTestId(
        'missing-model-import-not-supported-section'
      )
      expect(
        within(unsupportedSection)
          .getAllByTestId('model-row')
          .map((row) => row.getAttribute('data-model-name'))
      ).toEqual(['custom-node-model.safetensors', 'unknown.safetensors'])
      expect(
        within(unsupportedSection).getByText('Import Not Supported')
      ).toBeInTheDocument()
      expect(
        within(unsupportedSection).getByText(
          /Nodes that reference the models below do not support imported models/
        )
      ).toBeInTheDocument()
    })

    it('renders zero rows when missingModelGroups is empty', () => {
      mountCard({ missingModelGroups: [] })
      expect(getRows()).toHaveLength(0)
    })

    it('hides bulk actions in cloud', () => {
      mountCard({
        missingModelGroups: [makeGroup({ withDownloadUrls: true })]
      })

      expect(
        screen.queryByTestId('missing-model-actions')
      ).not.toBeInTheDocument()
    })

    it('does not show gated model guidance in cloud', async () => {
      const group = makeGroup({ withDownloadUrls: true })
      const url =
        'https://huggingface.co/comfy/test/resolve/main/model.safetensors'
      mountCard({ missingModelGroups: [group] })

      useMissingModelStore().gatedRepoUrls[url] =
        'https://huggingface.co/comfy/test'
      await nextTick()

      expect(
        screen.queryByTestId('missing-model-gated-hint')
      ).not.toBeInTheDocument()
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
    vi.clearAllMocks()
    mockIsCloud.value = false
  })

  afterEach(() => {
    mockIsCloud.value = true
  })

  it('shows directory name instead of "Import Not Supported" for unsupported groups', () => {
    mountCard({
      missingModelGroups: [
        makeGroup({ directory: 'checkpoints', isAssetSupported: false })
      ]
    })
    expect(getRows()[0].getAttribute('data-directory')).toBe('checkpoints')
  })

  it('passes null directory for unknown category rows in OSS', () => {
    mountCard({
      missingModelGroups: [
        makeGroup({ directory: null, isAssetSupported: false })
      ]
    })
    expect(getRows()[0].hasAttribute('data-directory')).toBe(false)
  })

  it('shows Download all at the bottom when one model is downloadable', () => {
    mountCard({
      missingModelGroups: [makeGroup({ withDownloadUrls: true })]
    })

    const actions = screen.getByTestId('missing-model-actions')
    expect(actions).toBeVisible()
    expect(
      within(actions).getByRole('button', { name: /Download all/ })
    ).toBeVisible()
  })

  it('shows gated model guidance in OSS', async () => {
    const group = makeGroup({ withDownloadUrls: true })
    const url =
      'https://huggingface.co/comfy/test/resolve/main/model.safetensors'
    mountCard({ missingModelGroups: [group] })

    useMissingModelStore().gatedRepoUrls[url] =
      'https://huggingface.co/comfy/test'
    await nextTick()

    expect(screen.getByRole('note')).toHaveTextContent(
      'Some models are gated. To download them, sign in to Hugging Face and accept the model license agreement.'
    )
  })

  it('does not show gated guidance for a model that is not downloadable', async () => {
    const group = makeGroup({
      modelNames: ['model.bin'],
      withDownloadUrls: true
    })
    const url = 'https://huggingface.co/comfy/test/resolve/main/model.bin'
    mountCard({ missingModelGroups: [group] })

    useMissingModelStore().gatedRepoUrls[url] =
      'https://huggingface.co/comfy/test'
    await nextTick()

    expect(
      screen.queryByTestId('missing-model-gated-hint')
    ).not.toBeInTheDocument()
  })

  it('routes Download all through the shared missing-model download handler', async () => {
    mountCard({
      missingModelGroups: [
        makeGroup({
          withDownloadUrls: true,
          modelNames: ['first.safetensors', 'second.safetensors']
        })
      ]
    })

    await userEvent.click(screen.getByTestId('missing-model-download-all'))

    expect(mockDownloadModel).toHaveBeenCalledTimes(2)
    expect(mockDownloadModel).toHaveBeenCalledWith(
      {
        name: 'first.safetensors',
        url: 'https://huggingface.co/comfy/test/resolve/main/first.safetensors',
        directory: 'checkpoints'
      },
      {}
    )
    expect(mockDownloadModel).toHaveBeenCalledWith(
      {
        name: 'second.safetensors',
        url: 'https://huggingface.co/comfy/test/resolve/main/second.safetensors',
        directory: 'checkpoints'
      },
      {}
    )
  })

  it('hides Download all when no model is downloadable', () => {
    mountCard()

    expect(
      screen.queryByRole('button', { name: /Download all/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('missing-model-actions')
    ).not.toBeInTheDocument()
  })
})
