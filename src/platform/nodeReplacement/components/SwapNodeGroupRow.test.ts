import { createTestingPinia } from '@pinia/testing'
import { fromAny } from '@total-typescript/shoehorn'
import { render, screen, within } from '@testing-library/vue'
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
      g: {
        nodesCount: '{count} node | {count} nodes'
      },
      rightSidePanel: {
        locateNodeFor: 'Locate {item}',
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
    'onLocate-node': (nodeId: string) => void
    onReplace: (group: SwapNodeGroup) => void
  }> = {}
) {
  return render(SwapNodeGroupRow, {
    props: {
      group: makeGroup(),
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

    it('renders node count as a badge', () => {
      renderRow()
      const badge = screen.getByLabelText('2 nodes')
      expect(badge).toBeInTheDocument()
      expect(within(badge).getByText('2')).toBeInTheDocument()
    })

    it('renders node count of 5 for 5 nodeTypes', () => {
      renderRow({
        group: makeGroup({
          nodeTypes: Array.from({ length: 5 }, (_, i) => ({
            type: 'OldNodeType',
            nodeId: String(i),
            isReplaceable: true
          }))
        })
      })
      const badge = screen.getByLabelText('5 nodes')
      expect(badge).toBeInTheDocument()
      expect(within(badge).getByText('5')).toBeInTheDocument()
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
      renderRow()
      expect(
        screen.queryByRole('button', { name: /^Locate / })
      ).not.toBeInTheDocument()
    })

    it('expands when title is clicked', async () => {
      const user = userEvent.setup()
      renderRow()
      await user.click(
        screen.getByRole('button', { name: 'Expand OldNodeType' })
      )
      expect(
        screen.getAllByRole('button', { name: 'Locate OldNodeType' })
      ).toHaveLength(2)
    })

    it('collapses when title is clicked again', async () => {
      const user = userEvent.setup()
      renderRow()
      await user.click(
        screen.getByRole('button', { name: 'Expand OldNodeType' })
      )
      expect(
        screen.getAllByRole('button', { name: 'Locate OldNodeType' })
      ).toHaveLength(2)
      await user.click(
        screen.getByRole('button', { name: 'Collapse OldNodeType' })
      )
      expect(
        screen.queryByRole('button', { name: /^Locate / })
      ).not.toBeInTheDocument()
    })

    it('updates the toggle control state when expanded', async () => {
      const user = userEvent.setup()
      renderRow()
      const titleButton = screen.getByRole('button', {
        name: 'Expand OldNodeType'
      })
      expect(titleButton).toHaveAttribute('aria-expanded', 'false')

      await user.click(titleButton)

      const collapseButton = screen.getByRole('button', {
        name: 'Collapse OldNodeType'
      })
      expect(collapseButton).toHaveAttribute('aria-expanded', 'true')
    })
  })

  describe('Node Type List (Expanded)', () => {
    async function expand() {
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /^Expand / }))
    }

    it('renders all nodeTypes when expanded', async () => {
      renderRow({
        group: makeGroup({
          type: 'GroupedNodeType',
          nodeTypes: [
            { type: 'GroupedNodeType', nodeId: '10', isReplaceable: true },
            { type: 'GroupedNodeType', nodeId: '20', isReplaceable: true },
            { type: 'GroupedNodeType', nodeId: '30', isReplaceable: true }
          ]
        })
      })
      expect(screen.queryByRole('list')).not.toBeInTheDocument()

      await expand()

      expect(
        within(screen.getByRole('list')).getAllByRole('listitem')
      ).toHaveLength(3)
      expect(
        within(screen.getByRole('list')).getAllByText('GroupedNodeType')
      ).toHaveLength(3)
    })

    it('renders Locate button for each nodeType with nodeId', async () => {
      renderRow()
      await expand()
      expect(
        screen.getAllByRole('button', { name: 'Locate OldNodeType' })
      ).toHaveLength(2)
    })

    it('does not render Locate button for nodeTypes without nodeId', async () => {
      renderRow({
        group: makeGroup({
          nodeTypes: fromAny<MissingNodeType[], unknown>([
            { type: 'NoIdNode', isReplaceable: true },
            { type: 'OtherNoIdNode', isReplaceable: true }
          ])
        })
      })
      await expand()
      expect(
        screen.queryByRole('button', { name: /^Locate / })
      ).not.toBeInTheDocument()
    })

    it('renders locate controls only for locatable nodeTypes', async () => {
      renderRow({
        group: makeGroup({
          type: 'MixedNodeType',
          nodeTypes: fromAny<MissingNodeType[], unknown>([
            { type: 'MixedNodeType', nodeId: '10', isReplaceable: true },
            { type: 'MixedNodeType', isReplaceable: true }
          ])
        })
      })

      await expand()

      expect(
        within(screen.getByRole('list')).getAllByText('MixedNodeType')
      ).toHaveLength(2)
      expect(
        within(screen.getByRole('list')).getAllByRole('button', {
          name: 'MixedNodeType'
        })
      ).toHaveLength(1)
      expect(
        screen.getAllByRole('button', { name: 'Locate MixedNodeType' })
      ).toHaveLength(1)
    })

    it('gives each locate control a node-specific accessible name', async () => {
      renderRow({
        group: makeGroup({
          type: 'AlphaNode',
          nodeTypes: [
            { type: 'AlphaNode', nodeId: '1', isReplaceable: true },
            { type: 'BetaNode', nodeId: '2', isReplaceable: true }
          ]
        })
      })

      await expand()

      expect(
        screen.getByRole('button', { name: 'Locate AlphaNode' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Locate BetaNode' })
      ).toBeInTheDocument()
    })
  })

  describe('Events', () => {
    it('emits locate-node with correct nodeId', async () => {
      const onLocateNode = vi.fn()
      const user = userEvent.setup()
      renderRow({ 'onLocate-node': onLocateNode })
      await user.click(
        screen.getByRole('button', { name: 'Expand OldNodeType' })
      )
      const locateBtns = screen.getAllByRole('button', {
        name: 'Locate OldNodeType'
      })
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

  describe('Single Node Groups', () => {
    it('locates a single node without expanding', async () => {
      const onLocateNode = vi.fn()
      const user = userEvent.setup()
      renderRow({
        group: makeGroup({
          type: 'SingleNodeType',
          nodeTypes: [
            { type: 'SingleNodeType', nodeId: '42', isReplaceable: true }
          ]
        }),
        'onLocate-node': onLocateNode
      })

      expect(
        screen.queryByRole('button', { name: /^Expand / })
      ).not.toBeInTheDocument()
      expect(screen.queryByLabelText('1 node')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'SingleNodeType' }))
      expect(onLocateNode).toHaveBeenCalledWith('42')

      await user.click(
        screen.getByRole('button', { name: 'Locate SingleNodeType' })
      )
      expect(onLocateNode).toHaveBeenCalledTimes(2)
      expect(onLocateNode).toHaveBeenLastCalledWith('42')
    })

    it('renders a single node without nodeId as non-locatable text', () => {
      renderRow({
        group: makeGroup({
          type: 'NoIdNode',
          nodeTypes: fromAny<MissingNodeType[], unknown>([
            { type: 'NoIdNode', isReplaceable: true }
          ])
        })
      })

      expect(screen.getByText('NoIdNode')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'NoIdNode' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /^Locate / })
      ).not.toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty nodeTypes array', () => {
      renderRow({
        group: makeGroup({
          nodeTypes: []
        })
      })

      expect(screen.getByText('OldNodeType')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'OldNodeType' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /^Expand / })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /^Locate / })
      ).not.toBeInTheDocument()
    })

    it('handles string nodeType entries', async () => {
      const user = userEvent.setup()
      renderRow({
        group: makeGroup({
          nodeTypes: fromAny<MissingNodeType[], unknown>([
            'StringType',
            'OtherStringType'
          ])
        })
      })
      await user.click(
        screen.getByRole('button', { name: 'Expand OldNodeType' })
      )

      expect(screen.getByText('StringType')).toBeInTheDocument()
      expect(screen.getByText('OtherStringType')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'StringType' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'OtherStringType' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /^Locate / })
      ).not.toBeInTheDocument()
    })
  })
})
