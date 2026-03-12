import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { SwapNodeGroup } from '@/components/rightSidePanel/errors/useErrorGroups'

vi.mock('./SwapNodeGroupRow.vue', () => ({
  default: {
    name: 'SwapNodeGroupRow',
    template: '<div class="swap-row" />',
    props: ['group', 'showNodeIdBadge'],
    emits: ['locate-node', 'replace']
  }
}))

import SwapNodesCard from './SwapNodesCard.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

function makeGroups(count = 2): SwapNodeGroup[] {
  return Array.from({ length: count }, (_, i) => ({
    type: `Type${i}`,
    newNodeId: `NewType${i}`,
    nodeTypes: [{ type: `Type${i}`, nodeId: String(i), isReplaceable: true }]
  }))
}

function mountCard(
  props: Partial<{
    swapNodeGroups: SwapNodeGroup[]
    showNodeIdBadge: boolean
  }> = {}
) {
  return mount(SwapNodesCard, {
    props: {
      swapNodeGroups: makeGroups(),
      showNodeIdBadge: false,
      ...props
    },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), PrimeVue, i18n]
    }
  })
}

describe('SwapNodesCard', () => {
  describe('Rendering', () => {
    it('renders guidance message', () => {
      const wrapper = mountCard()
      expect(wrapper.find('p').exists()).toBe(true)
    })

    it('renders correct number of SwapNodeGroupRow components', () => {
      const wrapper = mountCard({ swapNodeGroups: makeGroups(3) })
      expect(
        wrapper.findAllComponents({ name: 'SwapNodeGroupRow' })
      ).toHaveLength(3)
    })

    it('renders zero rows when swapNodeGroups is empty', () => {
      const wrapper = mountCard({ swapNodeGroups: [] })
      expect(
        wrapper.findAllComponents({ name: 'SwapNodeGroupRow' })
      ).toHaveLength(0)
    })

    it('renders one row when swapNodeGroups has one entry', () => {
      const wrapper = mountCard({ swapNodeGroups: makeGroups(1) })
      expect(
        wrapper.findAllComponents({ name: 'SwapNodeGroupRow' })
      ).toHaveLength(1)
    })

    it('passes showNodeIdBadge to children', () => {
      const wrapper = mountCard({
        swapNodeGroups: makeGroups(1),
        showNodeIdBadge: true
      })
      const row = wrapper.findComponent({ name: 'SwapNodeGroupRow' })
      expect(row.props('showNodeIdBadge')).toBe(true)
    })

    it('passes group prop to children', () => {
      const groups = makeGroups(1)
      const wrapper = mountCard({ swapNodeGroups: groups })
      const row = wrapper.findComponent({ name: 'SwapNodeGroupRow' })
      expect(row.props('group')).toEqual(groups[0])
    })
  })

  describe('Events', () => {
    it('bubbles locate-node event from child', async () => {
      const wrapper = mountCard()
      const row = wrapper.findComponent({ name: 'SwapNodeGroupRow' })
      await row.vm.$emit('locate-node', '42')
      expect(wrapper.emitted('locate-node')).toBeTruthy()
      expect(wrapper.emitted('locate-node')?.[0]).toEqual(['42'])
    })

    it('bubbles replace event from child', async () => {
      const groups = makeGroups(1)
      const wrapper = mountCard({ swapNodeGroups: groups })
      const row = wrapper.findComponent({ name: 'SwapNodeGroupRow' })
      await row.vm.$emit('replace', groups[0])
      expect(wrapper.emitted('replace')).toBeTruthy()
      expect(wrapper.emitted('replace')?.[0][0]).toEqual(groups[0])
    })

    it('bubbles events from correct child when multiple rows', async () => {
      const groups = makeGroups(3)
      const wrapper = mountCard({ swapNodeGroups: groups })
      const rows = wrapper.findAllComponents({ name: 'SwapNodeGroupRow' })

      await rows[2].vm.$emit('locate-node', '99')
      expect(wrapper.emitted('locate-node')?.[0]).toEqual(['99'])

      await rows[1].vm.$emit('replace', groups[1])
      expect(wrapper.emitted('replace')?.[0][0]).toEqual(groups[1])
    })
  })
})
