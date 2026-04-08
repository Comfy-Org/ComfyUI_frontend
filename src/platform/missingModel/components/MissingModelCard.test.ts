import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createI18n } from 'vue-i18n'

import type {
  MissingModelGroup,
  MissingModelViewModel
} from '@/platform/missingModel/types'

vi.mock('./MissingModelRow.vue', () => ({
  default: {
    name: 'MissingModelRow',
    template:
      '<div class="model-row" :data-show-node-id-badge="showNodeIdBadge" :data-is-asset-supported="isAssetSupported" :data-directory="directory"><button class="locate-trigger" @click="$emit(\'locate-model\', model?.representative?.nodeId)">Locate</button></div>',
    props: ['model', 'directory', 'showNodeIdBadge', 'isAssetSupported'],
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
  messages: {
    en: {
      rightSidePanel: {
        missingModels: {
          importNotSupported: 'Import Not Supported',
          customNodeDownloadDisabled:
            'Cloud environment does not support model imports for custom nodes.',
          unknownCategory: 'Unknown Category'
        }
      }
    }
  },
  missingWarn: false,
  fallbackWarn: false
})

function makeViewModel(
  name: string,
  nodeId: string = '1'
): MissingModelViewModel {
  return {
    name,
    representative: {
      name,
      nodeId,
      nodeType: 'CheckpointLoaderSimple',
      widgetName: 'ckpt_name',
      isAssetSupported: true,
      isMissing: true
    },
    referencingNodes: [{ nodeId, widgetName: 'ckpt_name' }]
  }
}

function makeGroup(
  opts: {
    directory?: string | null
    isAssetSupported?: boolean
    modelNames?: string[]
  } = {}
): MissingModelGroup {
  const names = opts.modelNames ?? ['model.safetensors']
  return {
    directory: 'directory' in opts ? (opts.directory ?? null) : 'checkpoints',
    isAssetSupported: opts.isAssetSupported ?? true,
    models: names.map((n, i) => makeViewModel(n, String(i + 1)))
  }
}

function mountCard(
  props: Partial<{
    missingModelGroups: MissingModelGroup[]
    showNodeIdBadge: boolean
  }> = {},
  onLocateModel?: (nodeId: string) => void
) {
  return render(MissingModelCard, {
    props: {
      missingModelGroups: [makeGroup()],
      showNodeIdBadge: false,
      ...props,
      ...(onLocateModel ? { onLocateModel } : {})
    },
    global: {
      plugins: [PrimeVue, i18n]
    }
  })
}

describe('MissingModelCard', () => {
  beforeEach(() => {
    mockIsCloud.value = true
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
})
