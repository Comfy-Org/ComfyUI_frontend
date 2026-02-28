import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { SwapNodeGroup } from '@/components/rightSidePanel/errors/useErrorGroups'
import SwapNodeGroupRow from './SwapNodeGroupRow.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

function makeGroup(overrides: Partial<SwapNodeGroup> = {}): SwapNodeGroup {
  return {
    type: 'OldNodeType',
    newNodeId: 'NewNodeType',
    nodeTypes: [
      { type: 'OldNodeType', nodeId: '1', isReplaceable: true },
      { type: 'OldNodeType', nodeId: '2', isReplaceable: true }
    ],
    ...overrides
  }
}

function findChevron(wrapper: ReturnType<typeof mountRow>) {
  const btn = wrapper
    .findAll('button')
    .find((b) => b.html().includes('chevron'))
  if (!btn) throw new Error('Chevron button not found')
  return btn
}

function mountRow(
  props: Partial<{
    group: SwapNodeGroup
    showNodeIdBadge: boolean
  }> = {}
) {
  return mount(SwapNodeGroupRow, {
    props: {
      group: makeGroup(),
      showNodeIdBadge: false,
      ...props
    },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), PrimeVue, i18n],
      stubs: {
        TransitionCollapse: { template: '<div><slot /></div>' }
      }
    }
  })
}

describe('SwapNodeGroupRow', () => {
  describe('Basic Rendering', () => {
    it('renders the group type name', () => {
      const wrapper = mountRow()
      expect(wrapper.text()).toContain('OldNodeType')
    })

    it('renders node count in parentheses', () => {
      const wrapper = mountRow()
      expect(wrapper.text()).toContain('(2)')
    })

    it('renders node count of 5 for 5 nodeTypes', () => {
      const wrapper = mountRow({
        group: makeGroup({
          nodeTypes: Array.from({ length: 5 }, (_, i) => ({
            type: 'OldNodeType',
            nodeId: String(i),
            isReplaceable: true
          }))
        })
      })
      expect(wrapper.text()).toContain('(5)')
    })

    it('renders the replacement target name', () => {
      const wrapper = mountRow()
      expect(wrapper.text()).toContain('NewNodeType')
    })

    it('shows "Unknown" when newNodeId is undefined', () => {
      const wrapper = mountRow({
        group: makeGroup({ newNodeId: undefined })
      })
      // Falls back to unknownNode key
      expect(wrapper.text()).toMatch(/unknown/i)
    })

    it('renders "Replace Node" button', () => {
      const wrapper = mountRow()
      const replaceBtn = wrapper
        .findAll('button')
        .find((b) => b.html().includes('repeat'))
      expect(replaceBtn).toBeTruthy()
    })
  })

  describe('Expand / Collapse', () => {
    it('starts collapsed — node list not visible', () => {
      const wrapper = mountRow()
      expect(wrapper.text()).not.toContain('#1')
    })

    it('expands when chevron is clicked', async () => {
      const wrapper = mountRow({ showNodeIdBadge: true })
      await findChevron(wrapper).trigger('click')
      expect(wrapper.text()).toContain('#1')
      expect(wrapper.text()).toContain('#2')
    })

    it('collapses when chevron is clicked again', async () => {
      const wrapper = mountRow({ showNodeIdBadge: true })
      await findChevron(wrapper).trigger('click')
      expect(wrapper.text()).toContain('#1')
      await findChevron(wrapper).trigger('click')
      expect(wrapper.text()).not.toContain('#1')
    })

    it('toggles chevron rotation when expanded', async () => {
      const wrapper = mountRow()
      expect(wrapper.html()).not.toContain('rotate-180')
      await findChevron(wrapper).trigger('click')
      expect(wrapper.html()).toContain('rotate-180')
    })
  })

  describe('Node Type List (Expanded)', () => {
    async function expand(wrapper: ReturnType<typeof mountRow>) {
      await findChevron(wrapper).trigger('click')
    }

    it('renders all nodeTypes when expanded', async () => {
      const wrapper = mountRow({
        group: makeGroup({
          nodeTypes: [
            { type: 'OldNodeType', nodeId: '10', isReplaceable: true },
            { type: 'OldNodeType', nodeId: '20', isReplaceable: true },
            { type: 'OldNodeType', nodeId: '30', isReplaceable: true }
          ]
        }),
        showNodeIdBadge: true
      })
      await expand(wrapper)
      expect(wrapper.text()).toContain('#10')
      expect(wrapper.text()).toContain('#20')
      expect(wrapper.text()).toContain('#30')
    })

    it('shows nodeId badge when showNodeIdBadge is true', async () => {
      const wrapper = mountRow({ showNodeIdBadge: true })
      await expand(wrapper)
      expect(wrapper.text()).toContain('#1')
      expect(wrapper.text()).toContain('#2')
    })

    it('hides nodeId badge when showNodeIdBadge is false', async () => {
      const wrapper = mountRow({ showNodeIdBadge: false })
      await expand(wrapper)
      expect(wrapper.text()).not.toContain('#1')
      expect(wrapper.text()).not.toContain('#2')
    })

    it('renders Locate button for each nodeType with nodeId', async () => {
      const wrapper = mountRow({ showNodeIdBadge: true })
      await expand(wrapper)
      const locateBtns = wrapper
        .findAll('button')
        .filter((b) => b.html().includes('locate'))
      expect(locateBtns).toHaveLength(2)
    })

    it('does not render Locate button for nodeTypes without nodeId', async () => {
      const wrapper = mountRow({
        group: makeGroup({
          nodeTypes: [{ type: 'NoIdNode', isReplaceable: true } as never]
        })
      })
      await expand(wrapper)
      const locateBtns = wrapper
        .findAll('button')
        .filter((b) => b.html().includes('locate'))
      expect(locateBtns).toHaveLength(0)
    })
  })

  describe('Events', () => {
    it('emits locate-node with correct nodeId', async () => {
      const wrapper = mountRow({ showNodeIdBadge: true })
      await findChevron(wrapper).trigger('click')
      const locateBtns = wrapper
        .findAll('button')
        .filter((b) => b.html().includes('locate'))
      await locateBtns[0].trigger('click')
      expect(wrapper.emitted('locate-node')).toBeTruthy()
      expect(wrapper.emitted('locate-node')?.[0]).toEqual(['1'])

      await locateBtns[1].trigger('click')
      expect(wrapper.emitted('locate-node')?.[1]).toEqual(['2'])
    })

    it('emits replace with group when Replace button is clicked', async () => {
      const group = makeGroup()
      const wrapper = mountRow({ group })
      const replaceBtn = wrapper
        .findAll('button')
        .find((b) => b.html().includes('repeat'))
      if (!replaceBtn) throw new Error('Replace button not found')
      await replaceBtn.trigger('click')
      expect(wrapper.emitted('replace')).toBeTruthy()
      expect(wrapper.emitted('replace')?.[0][0]).toEqual(group)
    })
  })

  describe('Edge Cases', () => {
    it('handles empty nodeTypes array', () => {
      const wrapper = mountRow({
        group: makeGroup({ nodeTypes: [] })
      })
      expect(wrapper.text()).toContain('(0)')
    })

    it('handles string nodeType entries', async () => {
      const wrapper = mountRow({
        group: makeGroup({
          nodeTypes: ['StringType'] as never[]
        })
      })
      await findChevron(wrapper).trigger('click')
      expect(wrapper.text()).toContain('StringType')
    })
  })
})
