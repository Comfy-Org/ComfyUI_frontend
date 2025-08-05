import { describe, expect, it, vi } from 'vitest'

import { LGraphButton } from '@/lib/litegraph/src/LGraphButton'
import { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

describe('LGraphNode Title Buttons', () => {
  describe('addTitleButton', () => {
    it('should add a title button to the node', () => {
      const node = new LGraphNode('Test Node')

      const button = node.addTitleButton({
        name: 'test_button',
        text: 'X',
        fgColor: '#FF0000'
      })

      expect(button).toBeInstanceOf(LGraphButton)
      expect(button.name).toBe('test_button')
      expect(button.text).toBe('X')
      expect(button.fgColor).toBe('#FF0000')
      expect(node.title_buttons).toHaveLength(1)
      expect(node.title_buttons[0]).toBe(button)
    })

    it('should add multiple title buttons', () => {
      const node = new LGraphNode('Test Node')

      const button1 = node.addTitleButton({ name: 'button1', text: 'A' })
      const button2 = node.addTitleButton({ name: 'button2', text: 'B' })
      const button3 = node.addTitleButton({ name: 'button3', text: 'C' })

      expect(node.title_buttons).toHaveLength(3)
      expect(node.title_buttons[0]).toBe(button1)
      expect(node.title_buttons[1]).toBe(button2)
      expect(node.title_buttons[2]).toBe(button3)
    })

    it('should create buttons with default options', () => {
      const node = new LGraphNode('Test Node')

      // @ts-expect-error TODO: Fix after merge - addTitleButton type issues
      const button = node.addTitleButton({})

      expect(button).toBeInstanceOf(LGraphButton)
      expect(button.name).toBeUndefined()
      expect(node.title_buttons).toHaveLength(1)
    })
  })

  describe('onMouseDown with title buttons', () => {
    it('should handle click on title button', () => {
      const node = new LGraphNode('Test Node')
      node.pos = [100, 200]
      node.size = [180, 60]

      const button = node.addTitleButton({
        name: 'close_button',
        text: 'X',
        // @ts-expect-error TODO: Fix after merge - visible property not defined in type
        visible: true
      })

      // Mock button dimensions
      button.getWidth = vi.fn().mockReturnValue(20)
      button.height = 16

      // Simulate button being drawn to populate _last_area
      // Button is drawn at node-relative coordinates
      // Button x: node.size[0] - 5 - button_width = 180 - 5 - 20 = 155
      // Button y: -LiteGraph.NODE_TITLE_HEIGHT = -30
      button._last_area[0] = 155
      button._last_area[1] = -30
      button._last_area[2] = 20
      button._last_area[3] = 16

      const canvas = {
        ctx: {} as CanvasRenderingContext2D,
        dispatch: vi.fn()
      } as unknown as LGraphCanvas

      const event = {
        canvasX: 265, // node.pos[0] + node.size[0] - 5 - button_width = 100 + 180 - 5 - 20 = 255, click in middle = 265
        canvasY: 178 // node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT + 8 = 200 - 30 + 8 = 178
      } as any

      // Calculate node-relative position for the click
      const clickPosRelativeToNode: [number, number] = [
        265 - node.pos[0], // 265 - 100 = 165
        178 - node.pos[1] // 178 - 200 = -22
      ]

      // Simulate the click - onMouseDown should detect button click
      // @ts-expect-error TODO: Fix after merge - onMouseDown method type issues
      const handled = node.onMouseDown(event, clickPosRelativeToNode, canvas)

      expect(handled).toBe(true)
      expect(canvas.dispatch).toHaveBeenCalledWith(
        'litegraph:node-title-button-clicked',
        {
          node: node,
          button: button
        }
      )
    })

    it('should not handle click outside title buttons', () => {
      const node = new LGraphNode('Test Node')
      node.pos = [100, 200]
      node.size = [180, 60]

      const button = node.addTitleButton({
        name: 'test_button',
        text: 'T',
        // @ts-expect-error TODO: Fix after merge - visible property not defined in type
        visible: true
      })

      button.getWidth = vi.fn().mockReturnValue(20)
      button.height = 16

      // Simulate button being drawn at node-relative coordinates
      button._last_area[0] = 155 // 180 - 5 - 20
      button._last_area[1] = -30 // -NODE_TITLE_HEIGHT
      button._last_area[2] = 20
      button._last_area[3] = 16

      const canvas = {
        ctx: {} as CanvasRenderingContext2D,
        dispatch: vi.fn()
      } as unknown as LGraphCanvas

      const event = {
        canvasX: 150, // Click in the middle of the node, not on button
        canvasY: 180
      } as any

      // Calculate node-relative position
      const clickPosRelativeToNode: [number, number] = [
        150 - node.pos[0], // 150 - 100 = 50
        180 - node.pos[1] // 180 - 200 = -20
      ]

      // @ts-expect-error TODO: Fix after merge - onMouseDown method type issues
      const handled = node.onMouseDown(event, clickPosRelativeToNode, canvas)

      expect(handled).toBe(false)
      expect(canvas.dispatch).not.toHaveBeenCalled()
    })

    it('should handle multiple buttons correctly', () => {
      const node = new LGraphNode('Test Node')
      node.pos = [100, 200]
      node.size = [200, 60]

      const button1 = node.addTitleButton({
        name: 'button1',
        text: 'A',
        // @ts-expect-error TODO: Fix after merge - visible property not defined in type
        visible: true
      })

      const button2 = node.addTitleButton({
        name: 'button2',
        text: 'B',
        // @ts-expect-error TODO: Fix after merge - visible property not defined in type
        visible: true
      })

      // Mock button dimensions
      button1.getWidth = vi.fn().mockReturnValue(20)
      button2.getWidth = vi.fn().mockReturnValue(20)
      button1.height = button2.height = 16

      // Simulate buttons being drawn at node-relative coordinates
      // First button (rightmost): 200 - 5 - 20 = 175
      button1._last_area[0] = 175
      button1._last_area[1] = -30 // -NODE_TITLE_HEIGHT
      button1._last_area[2] = 20
      button1._last_area[3] = 16

      // Second button: 175 - 5 - 20 = 150
      button2._last_area[0] = 150
      button2._last_area[1] = -30 // -NODE_TITLE_HEIGHT
      button2._last_area[2] = 20
      button2._last_area[3] = 16

      const canvas = {
        ctx: {} as CanvasRenderingContext2D,
        dispatch: vi.fn()
      } as unknown as LGraphCanvas

      // Click on second button (leftmost, since they're right-aligned)
      const titleY = 170 + 8 // node.pos[1] - NODE_TITLE_HEIGHT + 8 = 200 - 30 + 8 = 178
      const event = {
        canvasX: 255, // First button at: 100 + 200 - 5 - 20 = 275, Second button at: 275 - 5 - 20 = 250, click in middle = 255
        canvasY: titleY
      } as any

      // Calculate node-relative position
      const clickPosRelativeToNode: [number, number] = [
        255 - node.pos[0], // 255 - 100 = 155
        titleY - node.pos[1] // 178 - 200 = -22
      ]

      // @ts-expect-error onMouseDown possibly undefined
      const handled = node.onMouseDown(event, clickPosRelativeToNode, canvas)

      expect(handled).toBe(true)
      expect(canvas.dispatch).toHaveBeenCalledWith(
        'litegraph:node-title-button-clicked',
        {
          node: node,
          button: button2
        }
      )
    })

    it('should skip invisible buttons', () => {
      const node = new LGraphNode('Test Node')
      node.pos = [100, 200]
      node.size = [180, 60]

      const button1 = node.addTitleButton({
        name: 'invisible_button',
        text: '' // Empty text makes it invisible
      })

      const button2 = node.addTitleButton({
        name: 'visible_button',
        text: 'V'
      })

      button1.getWidth = vi.fn().mockReturnValue(20)
      button2.getWidth = vi.fn().mockReturnValue(20)
      button1.height = button2.height = 16

      // Simulate buttons being drawn at node-relative coordinates
      // Only visible button gets drawn area
      button2._last_area[0] = 155 // 180 - 5 - 20
      button2._last_area[1] = -30 // -NODE_TITLE_HEIGHT
      button2._last_area[2] = 20
      button2._last_area[3] = 16

      const canvas = {
        ctx: {} as CanvasRenderingContext2D,
        dispatch: vi.fn()
      } as unknown as LGraphCanvas

      // Click where the visible button is (invisible button is skipped)
      const titleY = 178 // node.pos[1] - NODE_TITLE_HEIGHT + 8 = 200 - 30 + 8 = 178
      const event = {
        canvasX: 265, // Visible button at: 100 + 180 - 5 - 20 = 255, click in middle = 265
        canvasY: titleY
      } as any

      // Calculate node-relative position
      const clickPosRelativeToNode: [number, number] = [
        265 - node.pos[0], // 265 - 100 = 165
        titleY - node.pos[1] // 178 - 200 = -22
      ]

      // @ts-expect-error onMouseDown possibly undefined
      const handled = node.onMouseDown(event, clickPosRelativeToNode, canvas)

      expect(handled).toBe(true)
      expect(canvas.dispatch).toHaveBeenCalledWith(
        'litegraph:node-title-button-clicked',
        {
          node: node,
          button: button2 // Should click visible button, not invisible
        }
      )
    })
  })

  describe('onTitleButtonClick', () => {
    it('should dispatch litegraph:node-title-button-clicked event', () => {
      const node = new LGraphNode('Test Node')
      // @ts-expect-error TODO: Fix after merge - LGraphButton constructor type issues
      const button = new LGraphButton({ name: 'test_button' })

      const canvas = {
        dispatch: vi.fn()
      } as unknown as LGraphCanvas

      node.onTitleButtonClick(button, canvas)

      expect(canvas.dispatch).toHaveBeenCalledWith(
        'litegraph:node-title-button-clicked',
        {
          node: node,
          button: button
        }
      )
    })
  })
})
