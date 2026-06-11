import { createTestingPinia } from '@pinia/testing'
import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type {
  MissingModelGroup,
  MissingModelViewModel
} from '@/platform/missingModel/types'

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
      >
        <button
          class="locate-trigger"
          @click="$emit('locate-model', model?.representative?.nodeId)"
        >
          Locate
        </button>
      </div>
    `,
    props: ['model', 'directory', 'isAssetSupported'],
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

describe('MissingModelCard', () => {
  beforeEach(() => {
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

    it('sorts rows by model type order in cloud', () => {
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
        getRows().map((row) => row.getAttribute('data-model-name'))
      ).toEqual([
        'checkpoint.safetensors',
        'lora.safetensors',
        'unknown.safetensors'
      ])
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
  })

  describe('Asset Unsupported Group', () => {
    it('does not show the unsupported group header in cloud', () => {
      const { container } = mountCard({
        missingModelGroups: [makeGroup({ isAssetSupported: false })]
      })
      expect(container.textContent).not.toContain('Import Not Supported')
    })

    it('does not show the unsupported group notice in cloud', () => {
      const { container } = mountCard({
        missingModelGroups: [makeGroup({ isAssetSupported: false })]
      })
      expect(container.textContent).not.toContain(
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

  it('hides info notice for unsupported groups', () => {
    const { container } = mountCard({
      missingModelGroups: [makeGroup({ isAssetSupported: false })]
    })
    expect(container.textContent).not.toContain(
      'Cloud environment does not support model imports'
    )
  })

  it('passes null directory for unknown category rows in OSS', () => {
    const { container } = mountCard({
      missingModelGroups: [
        makeGroup({ directory: null, isAssetSupported: false })
      ]
    })
    expect(getRows()[0].hasAttribute('data-directory')).toBe(false)
    expect(container.textContent).not.toContain('Import Not Supported')
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
    expect(
      within(actions).queryByRole('button', { name: 'Refresh' })
    ).not.toBeInTheDocument()
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
