/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createTestingPinia } from '@pinia/testing'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { SwapNodeGroup } from '@/components/rightSidePanel/errors/useErrorGroups'

vi.mock('./SwapNodeGroupRow.vue', () => ({
  default: {
    name: 'SwapNodeGroupRow',
    template:
      '<div class="swap-row" :data-show-node-id-badge="showNodeIdBadge" :data-group-type="group?.type"><button class="locate-trigger" @click="$emit(\'locate-node\', group?.nodeTypes?.[0]?.nodeId)">Locate</button><button class="replace-trigger" @click="$emit(\'replace\', group)">Replace</button></div>',
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
  }> = {},
  callbacks?: {
    onLocateNode?: (nodeId: string) => void
    onReplace?: (group: SwapNodeGroup) => void
  }
) {
  return render(SwapNodesCard, {
    props: {
      swapNodeGroups: makeGroups(),
      showNodeIdBadge: false,
      ...props,
      ...(callbacks?.onLocateNode
        ? { 'onLocate-node': callbacks.onLocateNode }
        : {}),
      ...(callbacks?.onReplace ? { onReplace: callbacks.onReplace } : {})
    },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), PrimeVue, i18n]
    }
  })
}

describe('SwapNodesCard', () => {
  describe('Rendering', () => {
    it('renders guidance message', () => {
      const { container } = mountCard()
      expect(container.querySelector('p')).not.toBeNull()
    })

    it('renders correct number of SwapNodeGroupRow components', () => {
      const { container } = mountCard({ swapNodeGroups: makeGroups(3) })
      expect(container.querySelectorAll('.swap-row')).toHaveLength(3)
    })

    it('renders zero rows when swapNodeGroups is empty', () => {
      const { container } = mountCard({ swapNodeGroups: [] })
      expect(container.querySelectorAll('.swap-row')).toHaveLength(0)
    })

    it('renders one row when swapNodeGroups has one entry', () => {
      const { container } = mountCard({ swapNodeGroups: makeGroups(1) })
      expect(container.querySelectorAll('.swap-row')).toHaveLength(1)
    })

    it('passes showNodeIdBadge to children', () => {
      const { container } = mountCard({
        swapNodeGroups: makeGroups(1),
        showNodeIdBadge: true
      })
      const row = container.querySelector('.swap-row')
      expect(row!.getAttribute('data-show-node-id-badge')).toBe('true')
    })

    it('passes group prop to children', () => {
      const groups = makeGroups(1)
      const { container } = mountCard({ swapNodeGroups: groups })
      const row = container.querySelector('.swap-row')
      expect(row!.getAttribute('data-group-type')).toBe(groups[0].type)
    })
  })

  describe('Events', () => {
    it('bubbles locate-node event from child', async () => {
      const onLocateNode = vi.fn()
      mountCard({}, { onLocateNode })
      const locateButtons = screen.getAllByRole('button', { name: 'Locate' })
      await userEvent.click(locateButtons[0])
      expect(onLocateNode).toHaveBeenCalledWith('0')
    })

    it('bubbles replace event from child', async () => {
      const groups = makeGroups(1)
      const onReplace = vi.fn()
      mountCard({ swapNodeGroups: groups }, { onReplace })
      const replaceButton = screen.getByRole('button', { name: 'Replace' })
      await userEvent.click(replaceButton)
      expect(onReplace).toHaveBeenCalledWith(groups[0])
    })

    it('bubbles events from correct child when multiple rows', async () => {
      const groups = makeGroups(3)
      const onLocateNode = vi.fn()
      const onReplace = vi.fn()
      mountCard({ swapNodeGroups: groups }, { onLocateNode, onReplace })

      const locateButtons = screen.getAllByRole('button', { name: 'Locate' })
      await userEvent.click(locateButtons[2])
      expect(onLocateNode).toHaveBeenCalledWith('2')

      const replaceButtons = screen.getAllByRole('button', {
        name: 'Replace'
      })
      await userEvent.click(replaceButtons[1])
      expect(onReplace).toHaveBeenCalledWith(groups[1])
    })
  })
})
