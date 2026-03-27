import { render } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { FuseFilter, FuseFilterWithValue } from '@/utils/fuseUtil'

import NodeSearchBoxPopover from './NodeSearchBoxPopover.vue'

const mockStoreRefs = vi.hoisted(() => ({
  visible: { value: false },
  newSearchBoxEnabled: { value: true }
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn()
  })
}))

vi.mock('pinia', async () => {
  const actual = await vi.importActual('pinia')
  return {
    ...(actual as Record<string, unknown>),
    storeToRefs: () => mockStoreRefs
  }
})

vi.mock('@/stores/workspace/searchBoxStore', () => ({
  useSearchBoxStore: () => ({})
}))

vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({
    getCanvasCenter: vi.fn(() => [0, 0]),
    addNodeOnGraph: vi.fn()
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: null
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: null,
    getCanvas: vi.fn(() => ({
      linkConnector: {
        events: new EventTarget(),
        renderLinks: []
      }
    }))
  })
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({
    nodeSearchService: {
      nodeFilters: [],
      inputTypeFilter: {},
      outputTypeFilter: {}
    }
  })
}))

let emitAddFilter:
  | ((filter: FuseFilterWithValue<ComfyNodeDefImpl, string>) => void)
  | null = null

const NodeSearchBoxStub = defineComponent({
  name: 'NodeSearchBox',
  props: {
    filters: { type: Array, default: () => [] }
  },
  emits: ['addFilter'],
  setup(props, { emit }) {
    emitAddFilter = (filter) => emit('addFilter', filter)
    const filterCount = computed(() => props.filters.length)
    return { filterCount }
  },
  template: '<div class="node-search-box" :data-filter-count="filterCount" />'
})

function createFilter(
  id: string,
  value: string
): FuseFilterWithValue<ComfyNodeDefImpl, string> {
  return {
    filterDef: { id } as FuseFilter<ComfyNodeDefImpl, string>,
    value
  }
}

describe('NodeSearchBoxPopover', () => {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: {} }
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    mockStoreRefs.visible.value = false
    emitAddFilter = null
  })

  function renderComponent() {
    return render(NodeSearchBoxPopover, {
      global: {
        plugins: [i18n, PrimeVue],
        stubs: {
          NodeSearchBox: NodeSearchBoxStub,
          Dialog: {
            template: '<div><slot name="container" /></div>',
            props: ['visible', 'modal', 'dismissableMask', 'pt']
          }
        }
      }
    })
  }

  describe('addFilter duplicate prevention', () => {
    it('should add a filter when no duplicates exist', async () => {
      const { container } = renderComponent()

      emitAddFilter!(createFilter('outputType', 'IMAGE'))
      await nextTick()

      /* eslint-disable testing-library/no-node-access, testing-library/no-container -- Stub component requires direct DOM access */
      const searchBox = container.querySelector('.node-search-box')
      expect(searchBox).toHaveAttribute('data-filter-count', '1')
      /* eslint-enable testing-library/no-node-access, testing-library/no-container */
    })

    it('should not add a duplicate filter with same id and value', async () => {
      const { container } = renderComponent()

      emitAddFilter!(createFilter('outputType', 'IMAGE'))
      await nextTick()
      emitAddFilter!(createFilter('outputType', 'IMAGE'))
      await nextTick()

      /* eslint-disable testing-library/no-node-access, testing-library/no-container -- Stub component requires direct DOM access */
      const searchBox = container.querySelector('.node-search-box')
      expect(searchBox).toHaveAttribute('data-filter-count', '1')
      /* eslint-enable testing-library/no-node-access, testing-library/no-container */
    })

    it('should allow filters with same id but different values', async () => {
      const { container } = renderComponent()

      emitAddFilter!(createFilter('outputType', 'IMAGE'))
      await nextTick()
      emitAddFilter!(createFilter('outputType', 'MASK'))
      await nextTick()

      /* eslint-disable testing-library/no-node-access, testing-library/no-container -- Stub component requires direct DOM access */
      const searchBox = container.querySelector('.node-search-box')
      expect(searchBox).toHaveAttribute('data-filter-count', '2')
      /* eslint-enable testing-library/no-node-access, testing-library/no-container */
    })

    it('should allow filters with different ids but same value', async () => {
      const { container } = renderComponent()

      emitAddFilter!(createFilter('outputType', 'IMAGE'))
      await nextTick()
      emitAddFilter!(createFilter('inputType', 'IMAGE'))
      await nextTick()

      /* eslint-disable testing-library/no-node-access, testing-library/no-container -- Stub component requires direct DOM access */
      const searchBox = container.querySelector('.node-search-box')
      expect(searchBox).toHaveAttribute('data-filter-count', '2')
      /* eslint-enable testing-library/no-node-access, testing-library/no-container */
    })
  })
})
