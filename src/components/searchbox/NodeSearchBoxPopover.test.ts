import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { CORE_SETTINGS } from '@/platform/settings/constants/coreSettings'
import type { Settings } from '@/schemas/apiSchema'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { FuseFilter, FuseFilterWithValue } from '@/utils/fuseUtil'

import NodeSearchBoxPopover from './NodeSearchBoxPopover.vue'

const coreSettingsById = Object.fromEntries(CORE_SETTINGS.map((s) => [s.id, s]))

const { addNodeOnGraph } = vi.hoisted(() => ({
  addNodeOnGraph: vi.fn()
}))

vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({
    getCanvasCenter: vi.fn(() => [0, 0]),
    addNodeOnGraph
  })
}))

type EmitAddFilter = (
  filter: FuseFilterWithValue<ComfyNodeDefImpl, string>
) => void
type EmitAddNode = (nodeDef: ComfyNodeDefImpl, dragEvent?: MouseEvent) => void

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

  function renderComponent(settings: Partial<Settings> = {}) {
    let emitAddFilter: EmitAddFilter | null = null
    let emitAddNodeV1: EmitAddNode | null = null
    let emitAddNodeV2: EmitAddNode | null = null

    const NodeSearchBoxStub = defineComponent({
      name: 'NodeSearchBox',
      props: {
        filters: { type: Array, default: () => [] }
      },
      emits: ['addFilter', 'addNode'],
      setup(props, { emit }) {
        emitAddFilter = (filter) => emit('addFilter', filter)
        emitAddNodeV1 = (nodeDef, dragEvent) =>
          emit('addNode', nodeDef, dragEvent)
        const filterCount = computed(() => props.filters.length)
        return { filterCount }
      },
      template: '<output aria-label="filter count">{{ filterCount }}</output>'
    })

    const NodeSearchContentStub = defineComponent({
      name: 'NodeSearchContent',
      props: {
        filters: { type: Array, default: () => [] }
      },
      emits: ['addFilter', 'removeFilter', 'addNode', 'hoverNode'],
      setup(_, { emit }) {
        emitAddNodeV2 = (nodeDef, dragEvent) =>
          emit('addNode', nodeDef, dragEvent)
        return {}
      },
      template: '<div data-testid="search-content-v2"></div>'
    })

    const pinia = createTestingPinia({
      stubActions: false,
      initialState: {
        setting: {
          settingValues: settings,
          settingsById: coreSettingsById
        },
        searchBox: { visible: false }
      }
    })

    const result = render(NodeSearchBoxPopover, {
      global: {
        plugins: [i18n, PrimeVue, pinia],
        stubs: {
          NodeSearchBox: NodeSearchBoxStub,
          NodeSearchContent: NodeSearchContentStub,
          NodePreviewCard: true,
          Dialog: {
            template: '<div><slot name="container" /></div>',
            props: ['visible', 'modal', 'dismissableMask', 'pt']
          }
        }
      }
    })

    return {
      ...result,
      get emitAddFilter() {
        if (!emitAddFilter) throw new Error('NodeSearchBox stub did not mount')
        return emitAddFilter
      },
      get emitAddNodeV1() {
        if (!emitAddNodeV1) throw new Error('NodeSearchBox stub did not mount')
        return emitAddNodeV1
      },
      get emitAddNodeV2() {
        if (!emitAddNodeV2)
          throw new Error('NodeSearchContent stub did not mount')
        return emitAddNodeV2
      }
    }
  }

  beforeEach(() => {
    addNodeOnGraph.mockReset()
    addNodeOnGraph.mockReturnValue(null)
  })

  describe('addFilter duplicate prevention', () => {
    it('should add a filter when no duplicates exist', async () => {
      const { emitAddFilter } = renderComponent({
        'Comfy.NodeSearchBoxImpl': 'v1 (legacy)'
      })

      emitAddFilter(createFilter('outputType', 'IMAGE'))
      await nextTick()

      expect(screen.getByLabelText('filter count')).toHaveTextContent('1')
    })

    it('should not add a duplicate filter with same id and value', async () => {
      const { emitAddFilter } = renderComponent({
        'Comfy.NodeSearchBoxImpl': 'v1 (legacy)'
      })

      emitAddFilter(createFilter('outputType', 'IMAGE'))
      await nextTick()
      emitAddFilter(createFilter('outputType', 'IMAGE'))
      await nextTick()

      expect(screen.getByLabelText('filter count')).toHaveTextContent('1')
    })

    it('should allow filters with same id but different values', async () => {
      const { emitAddFilter } = renderComponent({
        'Comfy.NodeSearchBoxImpl': 'v1 (legacy)'
      })

      emitAddFilter(createFilter('outputType', 'IMAGE'))
      await nextTick()
      emitAddFilter(createFilter('outputType', 'MASK'))
      await nextTick()

      expect(screen.getByLabelText('filter count')).toHaveTextContent('2')
    })

    it('should allow filters with different ids but same value', async () => {
      const { emitAddFilter } = renderComponent({
        'Comfy.NodeSearchBoxImpl': 'v1 (legacy)'
      })

      emitAddFilter(createFilter('outputType', 'IMAGE'))
      await nextTick()
      emitAddFilter(createFilter('inputType', 'IMAGE'))
      await nextTick()

      expect(screen.getByLabelText('filter count')).toHaveTextContent('2')
    })
  })

  describe('addNode ghost flag (FollowCursor setting)', () => {
    const nodeDef = { name: 'KSampler' } as ComfyNodeDefImpl

    it('should default ghost to true when v2 search is active and FollowCursor is unset', async () => {
      const { emitAddNodeV2 } = renderComponent({
        'Comfy.NodeSearchBoxImpl': 'default'
      })
      emitAddNodeV2(nodeDef)
      await nextTick()

      expect(addNodeOnGraph).toHaveBeenCalledWith(
        nodeDef,
        expect.objectContaining({ pos: expect.any(Array) }),
        expect.objectContaining({ ghost: true })
      )
    })

    it('should pass ghost: true when v2 search is active and FollowCursor is enabled', async () => {
      const { emitAddNodeV2 } = renderComponent({
        'Comfy.NodeSearchBoxImpl': 'default',
        'Comfy.NodeSearchBoxImpl.FollowCursor': true
      })
      emitAddNodeV2(nodeDef)
      await nextTick()

      expect(addNodeOnGraph).toHaveBeenCalledWith(
        nodeDef,
        expect.objectContaining({ pos: expect.any(Array) }),
        expect.objectContaining({ ghost: true })
      )
    })

    it('should pass ghost: false when v2 search is active but FollowCursor is disabled', async () => {
      const { emitAddNodeV2 } = renderComponent({
        'Comfy.NodeSearchBoxImpl': 'default',
        'Comfy.NodeSearchBoxImpl.FollowCursor': false
      })
      emitAddNodeV2(nodeDef)
      await nextTick()

      expect(addNodeOnGraph).toHaveBeenCalledWith(
        nodeDef,
        expect.objectContaining({ pos: expect.any(Array) }),
        expect.objectContaining({ ghost: false })
      )
    })

    it('should pass ghost: false when v1 legacy search box is used', async () => {
      const { emitAddNodeV1 } = renderComponent({
        'Comfy.NodeSearchBoxImpl': 'v1 (legacy)',
        'Comfy.NodeSearchBoxImpl.FollowCursor': true
      })
      emitAddNodeV1(nodeDef)
      await nextTick()

      expect(addNodeOnGraph).toHaveBeenCalledWith(
        nodeDef,
        expect.objectContaining({ pos: expect.any(Array) }),
        expect.objectContaining({ ghost: false })
      )
    })

    it('should pass ghost: false when litegraph legacy search box is used', async () => {
      const { emitAddNodeV1 } = renderComponent({
        'Comfy.NodeSearchBoxImpl': 'litegraph (legacy)',
        'Comfy.NodeSearchBoxImpl.FollowCursor': true
      })
      emitAddNodeV1(nodeDef)
      await nextTick()

      expect(addNodeOnGraph).toHaveBeenCalledWith(
        nodeDef,
        expect.objectContaining({ pos: expect.any(Array) }),
        expect.objectContaining({ ghost: false })
      )
    })

    it('should forward the dragEvent through to addNodeOnGraph', async () => {
      const dragEvent = new MouseEvent('mousedown')
      const { emitAddNodeV2 } = renderComponent({
        'Comfy.NodeSearchBoxImpl': 'default',
        'Comfy.NodeSearchBoxImpl.FollowCursor': true
      })
      emitAddNodeV2(nodeDef, dragEvent)
      await nextTick()

      expect(addNodeOnGraph).toHaveBeenCalledWith(
        nodeDef,
        expect.objectContaining({ pos: expect.any(Array) }),
        expect.objectContaining({ ghost: true, dragEvent })
      )
    })
  })
})
