import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { assertNodeSlotsWithinBounds } from '@e2e/fixtures/utils/slotBoundsUtil'

const NODE_ID = '3'
const NODE_TITLE = 'KSampler'

test.describe(
  'Collapsed node link positions',
  { tag: ['@canvas', '@node', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('default')
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('link endpoints stay within collapsed node bounds', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle(NODE_TITLE)
      await node.toggleCollapse()
      await comfyPage.nextFrame()

      await assertNodeSlotsWithinBounds(comfyPage.page, NODE_ID)
      await expect
        .poll(() =>
          comfyPage.page.evaluate((nodeId) => {
            const node = window.app!.canvas.graph!._nodes.find(
              (candidate) => String(candidate.id) === nodeId
            )
            return node?._collapsed_width ?? 0
          }, NODE_ID)
        )
        .toBeGreaterThan(0)
      const endpoint = await comfyPage.page.evaluate((nodeId) => {
        const node = window.app!.canvas.graph!._nodes.find(
          (candidate) => String(candidate.id) === nodeId
        )
        if (!node) throw new Error(`Node ${nodeId} not found`)
        const nodeElement = document.querySelector<HTMLElement>(
          `[data-node-id="${nodeId}"]`
        )
        if (!nodeElement) throw new Error(`Node element ${nodeId} not found`)
        node.updateArea()
        const bounds = node.getBounding()
        const output = node.getOutputPos(0)
        return {
          boundsRight: bounds[0] + bounds[2],
          boundsCenterY: bounds[1] + bounds[3] / 2,
          domRight: node.pos[0] + nodeElement.offsetWidth,
          outputX: output[0],
          outputY: output[1]
        }
      }, NODE_ID)
      expect(endpoint.outputX).toBeCloseTo(endpoint.domRight)
      expect(endpoint.outputX).toBeCloseTo(endpoint.boundsRight)
      expect(endpoint.outputY).toBeCloseTo(endpoint.boundsCenterY)
    })

    test('links follow collapsed node after drag', async ({ comfyPage }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle(NODE_TITLE)
      await node.toggleCollapse()
      await comfyPage.nextFrame()

      await expect.poll(async () => await node.boundingBox()).not.toBeNull()
      const box = await node.boundingBox()
      await comfyPage.page.mouse.move(
        box!.x + box!.width / 2,
        box!.y + box!.height / 2
      )
      await comfyPage.page.mouse.down()
      await comfyPage.page.mouse.move(
        box!.x + box!.width / 2 + 200,
        box!.y + box!.height / 2 + 100,
        { steps: 10 }
      )
      await comfyPage.page.mouse.up()
      await comfyPage.nextFrame()

      await assertNodeSlotsWithinBounds(comfyPage.page, NODE_ID)
    })

    test('links recover correct positions after expand', async ({
      comfyPage
    }) => {
      const serialized = await comfyPage.workflow.getExportedWorkflow()
      const serializedNode = serialized.nodes.find(
        (node) => String(node.id) === NODE_ID
      )
      if (!serializedNode) throw new Error(`Node ${NODE_ID} not found`)
      serializedNode.flags = { ...serializedNode.flags, collapsed: true }
      await comfyPage.workflow.loadGraphData(serialized)

      const collapsedNode =
        await comfyPage.vueNodes.getFixtureByTitle(NODE_TITLE)
      await expect(collapsedNode.root).toHaveAttribute('data-collapsed', 'true')
      await assertNodeSlotsWithinBounds(comfyPage.page, NODE_ID)
      const collapsedWidths = await comfyPage.page.evaluate((nodeId) => {
        const node = window.app!.canvas.graph!._nodes.find(
          (candidate) => String(candidate.id) === nodeId
        )
        if (!node) throw new Error(`Node ${nodeId} not found`)
        const element = document.querySelector<HTMLElement>(
          `[data-node-id="${nodeId}"]`
        )
        if (!element) throw new Error(`Node element ${nodeId} not found`)
        return {
          cached: node._collapsed_width,
          expected: node.measureCollapsedWidth(window.app!.canvas.ctx),
          rendered: element.offsetWidth
        }
      }, NODE_ID)
      expect(collapsedWidths.cached).toBeCloseTo(collapsedWidths.expected)
      expect(collapsedWidths.rendered).toBeCloseTo(collapsedWidths.expected)

      await comfyPage.page.evaluate((nodeId) => {
        const node = window.app!.canvas.graph!._nodes.find(
          (candidate) => String(candidate.id) === nodeId
        )
        if (!node) throw new Error(`Node ${nodeId} not found`)
        node.collapse()
      }, NODE_ID)
      await expect(collapsedNode.root).not.toHaveAttribute(
        'data-collapsed',
        'true'
      )
      await comfyPage.nextFrame()

      await assertNodeSlotsWithinBounds(comfyPage.page, NODE_ID)
      const getOutputAlignmentError = () =>
        comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.canvas.graph!._nodes.find(
            (candidate) => String(candidate.id) === nodeId
          )
          const slot = document.querySelector<HTMLElement>(
            `[data-node-id="${nodeId}"] .lg-slot--output [data-slot-key]`
          )
          const nodeElement = document.querySelector<HTMLElement>(
            `[data-node-id="${nodeId}"]`
          )
          if (!node || !slot || !nodeElement) return Number.POSITIVE_INFINITY

          const [x, y] = node.getOutputPos(0)
          const nodeRect = nodeElement.getBoundingClientRect()
          const slotRect = slot.getBoundingClientRect()
          const scale = nodeRect.width / node.size[0]
          const expectedX =
            node.pos[0] +
            (slotRect.left + slotRect.width / 2 - nodeRect.left) / scale
          const expectedY =
            node.pos[1] +
            (slotRect.top + slotRect.height / 2 - nodeRect.top) / scale -
            window.LiteGraph!.NODE_TITLE_HEIGHT
          return Math.hypot(x - expectedX, y - expectedY)
        }, NODE_ID)
      await expect.poll(getOutputAlignmentError).toBeLessThan(0.5)

      const box = await collapsedNode.boundingBox()
      if (!box) throw new Error(`Node ${NODE_ID} has no bounding box`)
      await comfyPage.page.mouse.move(box.x + 100, box.y + 15)
      await comfyPage.page.mouse.down()
      await comfyPage.page.mouse.move(box.x + 300, box.y + 115, { steps: 10 })
      await comfyPage.page.mouse.up()
      await comfyPage.nextFrame()

      await assertNodeSlotsWithinBounds(comfyPage.page, NODE_ID)
      await expect.poll(getOutputAlignmentError).toBeLessThan(0.5)
    })
  }
)

test.describe(
  'Collapsed node links inside subgraph on first entry',
  { tag: ['@canvas', '@node', '@vue-nodes', '@subgraph', '@screenshot'] },
  () => {
    test('renders collapsed node links correctly after fitView on first subgraph entry', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-collapsed-node'
      )
      await comfyPage.nextFrame()

      await comfyPage.vueNodes.enterSubgraph('2')

      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

      // fitView runs on first entry and re-syncs slot layouts for the
      // pre-collapsed KSampler. Screenshot captures the rendered canvas
      // links to guard against regressing the stale-coordinate bug.
      await expect(comfyPage.canvas).toHaveScreenshot(
        'subgraph-entry-collapsed-node-links.png'
      )
    })
  }
)
