import { createTestingPinia } from '@pinia/testing'
import { fromAny } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { SwapNodeGroup } from '@/components/rightSidePanel/errors/useErrorGroups'
import type { MissingNodeType } from '@/types/comfy'
import SwapNodeGroupRow from './SwapNodeGroupRow.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      rightSidePanel: {
        locateNode: 'Locate Node',
        missingNodePacks: {
          collapse: 'Collapse',
          expand: 'Expand'
        }
      },
      nodeReplacement: {
        willBeReplacedBy: 'This node will be replaced by:',
        replaceNode: 'Replace Node',
        unknownNode: 'Unknown'
      }
    }
  },
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

function renderRow(
  props: Partial<{
    group: SwapNodeGroup
    showNodeIdBadge: boolean
    'onLocate-node': (nodeId: string) => void
    onReplace: (group: SwapNodeGroup) => void
  }> = {}
) {
  return render(SwapNodeGroupRow, {
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
      const { container } = renderRow()
      expect(container.textContent).toContain('OldNodeType')
    })

    it('renders node count in parentheses', () => {
      const { container } = renderRow()
      expect(container.textContent).toContain('(2)')
    })

    it('renders node count of 5 for 5 nodeTypes', () => {
      const { container } = renderRow({
        group: makeGroup({
          nodeTypes: Array.from({ length: 5 }, (_, i) => ({
            type: 'OldNodeType',
            nodeId: String(i),
            isReplaceable: true
          }))
        })
      })
      expect(container.textContent).toContain('(5)')
    })

    it('renders the replacement target name', () => {
      const { container } = renderRow()
      expect(container.textContent).toContain('NewNodeType')
    })

    it('shows "Unknown" when newNodeId is undefined', () => {
      const { container } = renderRow({
        group: makeGroup({ newNodeId: undefined })
      })
      expect(container.textContent).toContain('Unknown')
    })

    it('renders "Replace Node" button', () => {
      renderRow()
      expect(
        screen.getByRole('button', { name: /Replace Node/ })
      ).toBeInTheDocument()
    })
  })

  describe('Expand / Collapse', () => {
    it('starts collapsed — node list not visible', () => {
      const { container } = renderRow({ showNodeIdBadge: true })
      expect(container.textContent).not.toContain('#1')
    })

    it('expands when chevron is clicked', async () => {
      const user = userEvent.setup()
      const { container } = renderRow({ showNodeIdBadge: true })
      await user.click(screen.getByRole('button', { name: 'Expand' }))
      expect(container.textContent).toContain('#1')
      expect(container.textContent).toContain('#2')
    })

    it('collapses when chevron is clicked again', async () => {
      const user = userEvent.setup()
      const { container } = renderRow({ showNodeIdBadge: true })
      await user.click(screen.getByRole('button', { name: 'Expand' }))
      expect(container.textContent).toContain('#1')
      await user.click(screen.getByRole('button', { name: 'Collapse' }))
      expect(container.textContent).not.toContain('#1')
    })

    it('updates the toggle control state when expanded', async () => {
      const user = userEvent.setup()
      renderRow()
      expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Expand' }))
      expect(
        screen.getByRole('button', { name: 'Collapse' })
      ).toBeInTheDocument()
    })
  })

  describe('Node Type List (Expanded)', () => {
    async function expand() {
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Expand' }))
    }

    it('renders all nodeTypes when expanded', async () => {
      const { container } = renderRow({
        group: makeGroup({
          nodeTypes: [
            { type: 'OldNodeType', nodeId: '10', isReplaceable: true },
            { type: 'OldNodeType', nodeId: '20', isReplaceable: true },
            { type: 'OldNodeType', nodeId: '30', isReplaceable: true }
          ]
        }),
        showNodeIdBadge: true
      })
      await expand()
      expect(container.textContent).toContain('#10')
      expect(container.textContent).toContain('#20')
      expect(container.textContent).toContain('#30')
    })

    it('shows nodeId badge when showNodeIdBadge is true', async () => {
      const { container } = renderRow({ showNodeIdBadge: true })
      await expand()
      expect(container.textContent).toContain('#1')
      expect(container.textContent).toContain('#2')
    })

    it('hides nodeId badge when showNodeIdBadge is false', async () => {
      const { container } = renderRow({ showNodeIdBadge: false })
      await expand()
      expect(container.textContent).not.toContain('#1')
      expect(container.textContent).not.toContain('#2')
    })

    it('renders Locate button for each nodeType with nodeId', async () => {
      renderRow({ showNodeIdBadge: true })
      await expand()
      expect(
        screen.getAllByRole('button', { name: 'Locate Node' })
      ).toHaveLength(2)
    })

    it('does not render Locate button for nodeTypes without nodeId', async () => {
      renderRow({
        group: makeGroup({
          // Intentionally omits nodeId to test graceful handling of incomplete node data
          nodeTypes: fromAny<MissingNodeType[], unknown>([
            { type: 'NoIdNode', isReplaceable: true }
          ])
        })
      })
      await expand()
      expect(
        screen.queryByRole('button', { name: 'Locate Node' })
      ).not.toBeInTheDocument()
    })
  })

  describe('Events', () => {
    it('emits locate-node with correct nodeId', async () => {
      const onLocateNode = vi.fn()
      const user = userEvent.setup()
      renderRow({ showNodeIdBadge: true, 'onLocate-node': onLocateNode })
      await user.click(screen.getByRole('button', { name: 'Expand' }))
      const locateBtns = screen.getAllByRole('button', { name: 'Locate Node' })
      await user.click(locateBtns[0])
      expect(onLocateNode).toHaveBeenCalledWith('1')

      await user.click(locateBtns[1])
      expect(onLocateNode).toHaveBeenCalledWith('2')
    })

    it('emits replace with group when Replace button is clicked', async () => {
      const group = makeGroup()
      const onReplace = vi.fn()
      const user = userEvent.setup()
      renderRow({ group, onReplace })
      const replaceBtn = screen.getByRole('button', { name: /Replace Node/ })
      await user.click(replaceBtn)
      expect(onReplace).toHaveBeenCalledWith(group)
    })
  })

  describe('Edge Cases', () => {
    it('handles empty nodeTypes array', () => {
      const { container } = renderRow({
        group: makeGroup({ nodeTypes: [] })
      })
      expect(container.textContent).toContain('(0)')
    })

    it('handles string nodeType entries', async () => {
      const user = userEvent.setup()
      const { container } = renderRow({
        group: makeGroup({
          // Intentionally uses a plain string entry to test legacy node type handling
          nodeTypes: fromAny<MissingNodeType[], unknown>(['StringType'])
        })
      })
      await user.click(screen.getByRole('button', { name: 'Expand' }))
      expect(container.textContent).toContain('StringType')
    })
  })
})
