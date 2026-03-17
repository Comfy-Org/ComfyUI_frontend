import { mount } from '@vue/test-utils'
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
    template: '<div class="model-row" />',
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
  }> = {}
) {
  return mount(MissingModelCard, {
    props: {
      missingModelGroups: [makeGroup()],
      showNodeIdBadge: false,
      ...props
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
      const wrapper = mountCard({
        missingModelGroups: [makeGroup({ directory: 'loras' })]
      })
      expect(wrapper.text()).toContain('loras')
    })

    it('renders translated unknown category when directory is null', () => {
      const wrapper = mountCard({
        missingModelGroups: [makeGroup({ directory: null })]
      })
      expect(wrapper.text()).toContain('Unknown Category')
    })

    it('renders model count in category header', () => {
      const wrapper = mountCard({
        missingModelGroups: [
          makeGroup({ modelNames: ['a.safetensors', 'b.safetensors'] })
        ]
      })
      expect(wrapper.text()).toContain('(2)')
    })

    it('renders correct number of MissingModelRow components', () => {
      const wrapper = mountCard({
        missingModelGroups: [
          makeGroup({
            modelNames: ['a.safetensors', 'b.safetensors', 'c.safetensors']
          })
        ]
      })
      expect(
        wrapper.findAllComponents({ name: 'MissingModelRow' })
      ).toHaveLength(3)
    })

    it('renders multiple groups', () => {
      const wrapper = mountCard({
        missingModelGroups: [
          makeGroup({ directory: 'checkpoints' }),
          makeGroup({ directory: 'loras' })
        ]
      })
      expect(wrapper.text()).toContain('checkpoints')
      expect(wrapper.text()).toContain('loras')
    })

    it('renders zero rows when missingModelGroups is empty', () => {
      const wrapper = mountCard({ missingModelGroups: [] })
      expect(
        wrapper.findAllComponents({ name: 'MissingModelRow' })
      ).toHaveLength(0)
    })

    it('passes props correctly to MissingModelRow children', () => {
      const wrapper = mountCard({ showNodeIdBadge: true })
      const row = wrapper.findComponent({ name: 'MissingModelRow' })
      expect(row.props('showNodeIdBadge')).toBe(true)
      expect(row.props('isAssetSupported')).toBe(true)
      expect(row.props('directory')).toBe('checkpoints')
    })
  })

  describe('Asset Unsupported Group', () => {
    it('shows "Import Not Supported" header for unsupported groups', () => {
      const wrapper = mountCard({
        missingModelGroups: [makeGroup({ isAssetSupported: false })]
      })
      expect(wrapper.text()).toContain('Import Not Supported')
    })

    it('shows info notice for unsupported groups', () => {
      const wrapper = mountCard({
        missingModelGroups: [makeGroup({ isAssetSupported: false })]
      })
      expect(wrapper.text()).toContain(
        'Cloud environment does not support model imports'
      )
    })

    it('hides info notice for supported groups', () => {
      const wrapper = mountCard({
        missingModelGroups: [makeGroup({ isAssetSupported: true })]
      })
      expect(wrapper.text()).not.toContain(
        'Cloud environment does not support model imports'
      )
    })
  })

  describe('Event Handling', () => {
    it('emits locateModel when child emits locate-model', async () => {
      const wrapper = mountCard()
      const row = wrapper.findComponent({ name: 'MissingModelRow' })
      await row.vm.$emit('locate-model', '42')
      expect(wrapper.emitted('locateModel')).toBeTruthy()
      expect(wrapper.emitted('locateModel')?.[0]).toEqual(['42'])
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
    const wrapper = mountCard({
      missingModelGroups: [
        makeGroup({ directory: 'checkpoints', isAssetSupported: false })
      ]
    })
    expect(wrapper.text()).toContain('checkpoints')
    expect(wrapper.text()).not.toContain('Import Not Supported')
  })

  it('hides info notice for unsupported groups', () => {
    const wrapper = mountCard({
      missingModelGroups: [makeGroup({ isAssetSupported: false })]
    })
    expect(wrapper.text()).not.toContain(
      'Cloud environment does not support model imports'
    )
  })

  it('renders unknown category for null directory in OSS', () => {
    const wrapper = mountCard({
      missingModelGroups: [
        makeGroup({ directory: null, isAssetSupported: false })
      ]
    })
    expect(wrapper.text()).toContain('Unknown Category')
    expect(wrapper.text()).not.toContain('Import Not Supported')
  })
})
