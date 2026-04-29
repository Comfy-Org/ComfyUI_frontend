import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphButton } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
})

describe('SubgraphNode Title Button', () => {
  describe('Constructor', () => {
    it('should automatically add enter_subgraph button', () => {
      const subgraph = createTestSubgraph({
        name: 'Test Subgraph',
        inputs: [{ name: 'input', type: 'number' }]
      })

      const subgraphNode = createTestSubgraphNode(subgraph)

      expect(subgraphNode.title_buttons).toHaveLength(1)

      const button = subgraphNode.title_buttons[0]
      expect(button).toBeInstanceOf(LGraphButton)
      expect(button.name).toBe('enter_subgraph')
    })

    it('should preserve enter_subgraph button when adding more buttons', () => {
      const subgraph = createTestSubgraph()
      const subgraphNode = createTestSubgraphNode(subgraph)

      // Add another button
      const customButton = subgraphNode.addTitleButton({
        name: 'custom_button',
        text: 'C'
      })

      expect(subgraphNode.title_buttons).toHaveLength(2)
      expect(subgraphNode.title_buttons[0].name).toBe('enter_subgraph')
      expect(subgraphNode.title_buttons[1]).toBe(customButton)
    })
  })

  describe('onTitleButtonClick', () => {
    it('should open subgraph when enter_subgraph button is clicked', () => {
      const subgraph = createTestSubgraph({
        name: 'Test Subgraph'
      })

      const subgraphNode = createTestSubgraphNode(subgraph)
      const enterButton = subgraphNode.title_buttons[0]

      const canvas = {
        openSubgraph: vi.fn(),
        dispatch: vi.fn()
      } as Partial<LGraphCanvas> as LGraphCanvas

      subgraphNode.onTitleButtonClick(enterButton, canvas)

      expect(canvas.openSubgraph).toHaveBeenCalledWith(subgraph, subgraphNode)
      expect(canvas.dispatch).not.toHaveBeenCalled() // Should not call parent implementation
    })

    it('should call parent implementation for other buttons', () => {
      const subgraph = createTestSubgraph()
      const subgraphNode = createTestSubgraphNode(subgraph)

      const customButton = subgraphNode.addTitleButton({
        name: 'custom_button',
        text: 'X'
      })

      const canvas = {
        openSubgraph: vi.fn(),
        dispatch: vi.fn()
      } as Partial<LGraphCanvas> as LGraphCanvas

      subgraphNode.onTitleButtonClick(customButton, canvas)

      expect(canvas.openSubgraph).not.toHaveBeenCalled()
      expect(canvas.dispatch).toHaveBeenCalledWith(
        'litegraph:node-title-button-clicked',
        {
          node: subgraphNode,
          button: customButton
        }
      )
    })
  })

  describe('Integration with node click handling', () => {
    it('should expose button hit testing that canvas uses for click routing', () => {
      const subgraph = createTestSubgraph({
        name: 'Nested Subgraph',
        nodeCount: 3
      })

      const subgraphNode = createTestSubgraphNode(subgraph)
      subgraphNode.pos = [100, 100]
      subgraphNode.size = [200, 100]

      const enterButton = subgraphNode.title_buttons[0]
      enterButton.getWidth = vi.fn().mockReturnValue(25)
      enterButton.height = 20

      // Simulate button being drawn at node-relative coordinates
      // Button x: 200 - 5 - 25 = 170
      // Button y: -30 (title height)
      enterButton._last_area[0] = 170
      enterButton._last_area[1] = -30
      enterButton._last_area[2] = 25
      enterButton._last_area[3] = 20

      const canvas = {
        ctx: {
          measureText: vi.fn().mockReturnValue({ width: 25 })
        } as Partial<CanvasRenderingContext2D> as CanvasRenderingContext2D,
        openSubgraph: vi.fn(),
        dispatch: vi.fn()
      } as Partial<LGraphCanvas> as LGraphCanvas

      // Calculate node-relative position
      const clickPosRelativeToNode: [number, number] = [
        275 - subgraphNode.pos[0], // 275 - 100 = 175
        80 - subgraphNode.pos[1] // 80 - 100 = -20
      ]

      expect(
        enterButton.isPointInside(
          clickPosRelativeToNode[0],
          clickPosRelativeToNode[1]
        )
      ).toBe(true)

      subgraphNode.onTitleButtonClick(enterButton, canvas)
      expect(canvas.openSubgraph).toHaveBeenCalledWith(subgraph, subgraphNode)
    })

    it('does not report hits outside the enter button area', () => {
      const subgraph = createTestSubgraph()
      const subgraphNode = createTestSubgraphNode(subgraph)
      subgraphNode.pos = [100, 100]
      subgraphNode.size = [200, 100]

      const enterButton = subgraphNode.title_buttons[0]
      enterButton.getWidth = vi.fn().mockReturnValue(25)
      enterButton.height = 20
      enterButton._last_area[0] = 170
      enterButton._last_area[1] = -30
      enterButton._last_area[2] = 25
      enterButton._last_area[3] = 20

      const bodyClickRelativeToNode: [number, number] = [100, 50]

      expect(
        enterButton.isPointInside(
          bodyClickRelativeToNode[0],
          bodyClickRelativeToNode[1]
        )
      ).toBe(false)
    })

    it('keeps enter button metadata but canvas is responsible for collapsed guard', () => {
      const subgraph = createTestSubgraph()
      const subgraphNode = createTestSubgraphNode(subgraph)
      subgraphNode.pos = [100, 100]
      subgraphNode.size = [200, 100]
      subgraphNode.flags.collapsed = true

      const enterButton = subgraphNode.title_buttons[0]
      enterButton.getWidth = vi.fn().mockReturnValue(25)
      enterButton.height = 20

      // Set button area as if it was drawn
      enterButton._last_area[0] = 170
      enterButton._last_area[1] = -30
      enterButton._last_area[2] = 25
      enterButton._last_area[3] = 20

      const clickPosRelativeToNode: [number, number] = [
        275 - subgraphNode.pos[0], // 175
        80 - subgraphNode.pos[1] // -20
      ]

      expect(
        enterButton.isPointInside(
          clickPosRelativeToNode[0],
          clickPosRelativeToNode[1]
        )
      ).toBe(true)
      expect(subgraphNode.flags.collapsed).toBe(true)
    })
  })
})
