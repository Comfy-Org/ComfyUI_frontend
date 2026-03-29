import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { FuseFilter, FuseFilterWithValue } from '@/utils/fuseUtil'

import NodeSearchBoxPopover from './NodeSearchBoxPopover.vue'

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn()
  })
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

type EmitAddFilter = (
  filter: FuseFilterWithValue<ComfyNodeDefImpl, string>
) => void

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

  function renderComponent() {
    let emitAddFilter: EmitAddFilter | null = null

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
      template: '<output aria-label="filter count">{{ filterCount }}</output>'
    })

    const pinia = createTestingPinia({
      stubActions: false,
      initialState: {
        searchBox: { visible: false }
      }
    })

    const result = render(NodeSearchBoxPopover, {
      global: {
        plugins: [i18n, PrimeVue, pinia],
        stubs: {
          NodeSearchBox: NodeSearchBoxStub,
          Dialog: {
            template: '<div><slot name="container" /></div>',
            props: ['visible', 'modal', 'dismissableMask', 'pt']
          }
        }
      }
    })

    if (!emitAddFilter) throw new Error('NodeSearchBox stub did not mount')

    return { ...result, emitAddFilter: emitAddFilter as EmitAddFilter }
  }

  describe('addFilter duplicate prevention', () => {
    it('should add a filter when no duplicates exist', async () => {
      const { emitAddFilter } = renderComponent()

      emitAddFilter(createFilter('outputType', 'IMAGE'))
      await nextTick()

      expect(screen.getByLabelText('filter count')).toHaveTextContent('1')
    })

    it('should not add a duplicate filter with same id and value', async () => {
      const { emitAddFilter } = renderComponent()

      emitAddFilter(createFilter('outputType', 'IMAGE'))
      await nextTick()
      emitAddFilter(createFilter('outputType', 'IMAGE'))
      await nextTick()

      expect(screen.getByLabelText('filter count')).toHaveTextContent('1')
    })

    it('should allow filters with same id but different values', async () => {
      const { emitAddFilter } = renderComponent()

      emitAddFilter(createFilter('outputType', 'IMAGE'))
      await nextTick()
      emitAddFilter(createFilter('outputType', 'MASK'))
      await nextTick()

      expect(screen.getByLabelText('filter count')).toHaveTextContent('2')
    })

    it('should allow filters with different ids but same value', async () => {
      const { emitAddFilter } = renderComponent()

      emitAddFilter(createFilter('outputType', 'IMAGE'))
      await nextTick()
      emitAddFilter(createFilter('inputType', 'IMAGE'))
      await nextTick()

      expect(screen.getByLabelText('filter count')).toHaveTextContent('2')
    })
  })
})
