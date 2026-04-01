import { readFileSync } from 'fs'
import { resolve } from 'path'

import { expect } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { comfyPageFixture as test, comfyExpect } from '../../fixtures/ComfyPage'
import { SubgraphHelper } from '../../fixtures/helpers/SubgraphHelper'
import {
  expectSlotsWithinBounds,
  measureNodeSlotOffsets
} from '../../fixtures/utils/slotBoundsUtil'

// Constants
const RENAMED_INPUT_NAME = 'renamed_input'
const RENAMED_NAME = 'renamed_slot_name'
const SECOND_RENAMED_NAME = 'second_renamed_name'
const RENAMED_LABEL = 'my_seed'

// Common selectors
const SELECTORS = {
  promptDialog: '.graphdialog input'
} as const

test.describe('Subgraph Slots', { tag: ['@slow', '@subgraph'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    await comfyPage.settings.setSetting(
      'Comfy.NodeSearchBoxImpl',
      'v1 (legacy)'
    )
  })

  test.describe('I/O Slot CRUD', () => {
    test('Can add input slots to subgraph', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialCount = await comfyPage.subgraph.getSlotCount('input')
      const [vaeEncodeNode] = await comfyPage.nodeOps.getNodeRefsByType(
        'VAEEncode',
        true
      )

      await comfyPage.subgraph.connectFromInput(vaeEncodeNode, 0)
      await comfyPage.nextFrame()

      const finalCount = await comfyPage.subgraph.getSlotCount('input')
      expect(finalCount).toBe(initialCount + 1)
    })

    test('Can add output slots to subgraph', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialCount = await comfyPage.subgraph.getSlotCount('output')
      const [vaeEncodeNode] = await comfyPage.nodeOps.getNodeRefsByType(
        'VAEEncode',
        true
      )

      await comfyPage.subgraph.connectToOutput(vaeEncodeNode, 0)
      await comfyPage.nextFrame()

      const finalCount = await comfyPage.subgraph.getSlotCount('output')
      expect(finalCount).toBe(initialCount + 1)
    })

    test('Can remove input slots from subgraph', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialCount = await comfyPage.subgraph.getSlotCount('input')
      expect(initialCount).toBeGreaterThan(0)

      await comfyPage.subgraph.removeSlot('input')

      // Force re-render
      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()

      const finalCount = await comfyPage.subgraph.getSlotCount('input')
      expect(finalCount).toBe(initialCount - 1)
    })

    test('Can remove output slots from subgraph', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialCount = await comfyPage.subgraph.getSlotCount('output')
      expect(initialCount).toBeGreaterThan(0)

      await comfyPage.subgraph.removeSlot('output')

      // Force re-render
      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()

      const finalCount = await comfyPage.subgraph.getSlotCount('output')
      expect(finalCount).toBe(initialCount - 1)
    })
  })

  test.describe('Slot Rename', () => {
    test('Can rename I/O slots via right-click context menu', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialInputLabel = await comfyPage.subgraph.getSlotLabel('input')

      await comfyPage.subgraph.rightClickInputSlot(initialInputLabel!)
      await comfyPage.contextMenu.clickLitegraphMenuItem('Rename Slot')
      await comfyPage.nextFrame()

      await comfyPage.page.waitForSelector(SELECTORS.promptDialog, {
        state: 'visible'
      })
      await comfyPage.page.fill(SELECTORS.promptDialog, RENAMED_INPUT_NAME)
      await comfyPage.page.keyboard.press('Enter')

      // Force re-render
      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()

      const newInputName = await comfyPage.subgraph.getSlotLabel('input')

      expect(newInputName).toBe(RENAMED_INPUT_NAME)
      expect(newInputName).not.toBe(initialInputLabel)
    })

    test('Can rename input slots via double-click', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialInputLabel = await comfyPage.subgraph.getSlotLabel('input')

      await comfyPage.subgraph.doubleClickInputSlot(initialInputLabel!)

      await comfyPage.page.waitForSelector(SELECTORS.promptDialog, {
        state: 'visible'
      })
      await comfyPage.page.fill(SELECTORS.promptDialog, RENAMED_INPUT_NAME)
      await comfyPage.page.keyboard.press('Enter')

      // Force re-render
      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()

      const newInputName = await comfyPage.subgraph.getSlotLabel('input')

      expect(newInputName).toBe(RENAMED_INPUT_NAME)
      expect(newInputName).not.toBe(initialInputLabel)
    })

    test('Can rename output slots via double-click', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialOutputLabel = await comfyPage.subgraph.getSlotLabel('output')

      await comfyPage.subgraph.doubleClickOutputSlot(initialOutputLabel!)

      await comfyPage.page.waitForSelector(SELECTORS.promptDialog, {
        state: 'visible'
      })
      const renamedOutputName = 'renamed_output'
      await comfyPage.page.fill(SELECTORS.promptDialog, renamedOutputName)
      await comfyPage.page.keyboard.press('Enter')

      // Force re-render
      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()

      const newOutputName = await comfyPage.subgraph.getSlotLabel('output')

      expect(newOutputName).toBe(renamedOutputName)
      expect(newOutputName).not.toBe(initialOutputLabel)
    })

    test('Right-click context menu still works alongside double-click', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialInputLabel = await comfyPage.subgraph.getSlotLabel('input')

      // Test that right-click still works for renaming
      await comfyPage.subgraph.rightClickInputSlot(initialInputLabel!)
      await comfyPage.contextMenu.clickLitegraphMenuItem('Rename Slot')
      await comfyPage.nextFrame()

      await comfyPage.page.waitForSelector(SELECTORS.promptDialog, {
        state: 'visible'
      })
      const rightClickRenamedName = 'right_click_renamed'
      await comfyPage.page.fill(SELECTORS.promptDialog, rightClickRenamedName)
      await comfyPage.page.keyboard.press('Enter')

      // Force re-render
      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()

      const newInputName = await comfyPage.subgraph.getSlotLabel('input')

      expect(newInputName).toBe(rightClickRenamedName)
      expect(newInputName).not.toBe(initialInputLabel)
    })

    test('Can double-click on slot label text to rename', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialInputLabel = await comfyPage.subgraph.getSlotLabel('input')

      // Use direct pointer event approach to double-click on label
      await comfyPage.page.evaluate(() => {
        const app = window.app!

        const graph = app.canvas.graph
        if (!graph || !('inputNode' in graph)) {
          throw new Error('Expected to be in subgraph')
        }
        const input = graph.inputs?.[0]

        if (!input?.labelPos) {
          throw new Error('Could not get label position for testing')
        }

        // Use labelPos for more precise clicking on the text
        const testX = input.labelPos[0]
        const testY = input.labelPos[1]

        // Create a minimal mock event with required properties
        // Full PointerEvent creation is unnecessary for this test
        const leftClickEvent = {
          canvasX: testX,
          canvasY: testY,
          button: 0,
          preventDefault: () => {},
          stopPropagation: () => {}
        } as Parameters<typeof graph.inputNode.onPointerDown>[0]

        const inputNode = graph.inputNode
        if (inputNode?.onPointerDown) {
          inputNode.onPointerDown(
            leftClickEvent,
            app.canvas.pointer,
            app.canvas.linkConnector
          )

          // Trigger double-click if pointer has the handler
          if (app.canvas.pointer.onDoubleClick) {
            app.canvas.pointer.onDoubleClick(leftClickEvent)
          }
        }
      })

      await comfyPage.nextFrame()

      await comfyPage.page.waitForSelector(SELECTORS.promptDialog, {
        state: 'visible'
      })
      const labelClickRenamedName = 'label_click_renamed'
      await comfyPage.page.fill(SELECTORS.promptDialog, labelClickRenamedName)
      await comfyPage.page.keyboard.press('Enter')

      // Force re-render
      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()

      const newInputName = await comfyPage.subgraph.getSlotLabel('input')

      expect(newInputName).toBe(labelClickRenamedName)
      expect(newInputName).not.toBe(initialInputLabel)
    })
  })

  test.describe('Slot Rename Dialog', () => {
    test('Shows current slot label (not stale) in rename dialog', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      // Get initial slot label
      const initialInputLabel = await comfyPage.subgraph.getSlotLabel('input')

      if (initialInputLabel === null) {
        throw new Error(
          'Expected subgraph to have an input slot label for rightClickInputSlot'
        )
      }

      // First rename
      await comfyPage.subgraph.rightClickInputSlot(initialInputLabel)
      await comfyPage.contextMenu.clickLitegraphMenuItem('Rename Slot')
      await comfyPage.nextFrame()

      await comfyPage.page.waitForSelector(SELECTORS.promptDialog, {
        state: 'visible'
      })

      // Clear and enter new name
      await comfyPage.page.fill(SELECTORS.promptDialog, '')
      await comfyPage.page.fill(SELECTORS.promptDialog, RENAMED_NAME)
      await comfyPage.page.keyboard.press('Enter')

      // Wait for dialog to close
      await comfyPage.page.waitForSelector(SELECTORS.promptDialog, {
        state: 'hidden'
      })

      // Force re-render
      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()

      // Verify the rename worked
      const afterFirstRename = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph
        if (!graph || !('inputNode' in graph))
          return { label: null, name: null, displayName: null }
        const slot = graph.inputs?.[0]
        return {
          label: slot?.label || null,
          name: slot?.name || null,
          displayName: slot?.displayName || slot?.label || slot?.name || null
        }
      })
      expect(afterFirstRename.label).toBe(RENAMED_NAME)

      // Now rename again - this is where the bug would show
      // We need to use the index-based approach since the method looks for slot.name
      await comfyPage.subgraph.rightClickInputSlot()
      await comfyPage.contextMenu.clickLitegraphMenuItem('Rename Slot')
      await comfyPage.nextFrame()

      await comfyPage.page.waitForSelector(SELECTORS.promptDialog, {
        state: 'visible'
      })

      // Get the current value in the prompt dialog
      const dialogValue = await comfyPage.page.inputValue(
        SELECTORS.promptDialog
      )

      // This should show the current label (RENAMED_NAME), not the original name
      expect(dialogValue).toBe(RENAMED_NAME)
      expect(dialogValue).not.toBe(afterFirstRename.name) // Should not show the original slot.name

      // Complete the second rename to ensure everything still works
      await comfyPage.page.fill(SELECTORS.promptDialog, '')
      await comfyPage.page.fill(SELECTORS.promptDialog, SECOND_RENAMED_NAME)
      await comfyPage.page.keyboard.press('Enter')

      // Wait for dialog to close
      await comfyPage.page.waitForSelector(SELECTORS.promptDialog, {
        state: 'hidden'
      })

      // Force re-render
      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()

      // Verify the second rename worked
      const afterSecondRename = await comfyPage.subgraph.getSlotLabel('input')
      expect(afterSecondRename).toBe(SECOND_RENAMED_NAME)
    })

    test('Shows current output slot label in rename dialog', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      // Get initial output slot label
      const initialOutputLabel = await comfyPage.subgraph.getSlotLabel('output')

      if (initialOutputLabel === null) {
        throw new Error(
          'Expected subgraph to have an output slot label for rightClickOutputSlot'
        )
      }

      // First rename
      await comfyPage.subgraph.rightClickOutputSlot(initialOutputLabel)
      await comfyPage.contextMenu.clickLitegraphMenuItem('Rename Slot')
      await comfyPage.nextFrame()

      await comfyPage.page.waitForSelector(SELECTORS.promptDialog, {
        state: 'visible'
      })

      // Clear and enter new name
      await comfyPage.page.fill(SELECTORS.promptDialog, '')
      await comfyPage.page.fill(SELECTORS.promptDialog, RENAMED_NAME)
      await comfyPage.page.keyboard.press('Enter')

      // Wait for dialog to close
      await comfyPage.page.waitForSelector(SELECTORS.promptDialog, {
        state: 'hidden'
      })

      // Force re-render
      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()

      // Now rename again to check for stale content
      // We need to use the index-based approach since the method looks for slot.name
      await comfyPage.subgraph.rightClickOutputSlot()
      await comfyPage.contextMenu.clickLitegraphMenuItem('Rename Slot')
      await comfyPage.nextFrame()

      await comfyPage.page.waitForSelector(SELECTORS.promptDialog, {
        state: 'visible'
      })

      // Get the current value in the prompt dialog
      const dialogValue = await comfyPage.page.inputValue(
        SELECTORS.promptDialog
      )

      // This should show the current label (RENAMED_NAME), not the original name
      expect(dialogValue).toBe(RENAMED_NAME)
    })
  })

  test.describe('Slot Rename Propagation', () => {
    /**
     * Regression test for subgraph input slot rename propagation.
     *
     * Renaming a SubgraphInput slot (e.g. "seed") inside the subgraph must
     * update the promoted widget label shown on the parent SubgraphNode and
     * keep the widget positioned in the node body (not the header).
     *
     * See: https://github.com/Comfy-Org/ComfyUI_frontend/pull/10195
     */
    test('Renaming a subgraph input slot updates the widget label on the parent node', async ({
      comfyPage
    }) => {
      const { page } = comfyPage
      const WORKFLOW = 'subgraphs/test-values-input-subgraph'

      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)

      // 1. Load workflow with subgraph containing a promoted seed widget input
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()

      const sgNode = comfyPage.vueNodes.getNodeLocator('19')
      await comfyExpect(sgNode).toBeVisible()

      // 2. Verify the seed widget is visible on the parent node
      const seedWidget = sgNode.getByLabel('seed', { exact: true })
      await comfyExpect(seedWidget).toBeVisible()

      // Verify widget is in the node body, not the header
      await SubgraphHelper.expectWidgetBelowHeader(sgNode, seedWidget)

      // 3. Enter the subgraph and rename the seed slot.
      //    The subgraph IO rename uses canvas.prompt() which requires the
      //    litegraph context menu, so temporarily disable Vue nodes.
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await comfyPage.nextFrame()

      const sgNodeRef = await comfyPage.nodeOps.getNodeRefById('19')
      await sgNodeRef.navigateIntoSubgraph()

      // Find the seed SubgraphInput slot
      const seedSlotName = await page.evaluate(() => {
        const graph = window.app!.canvas.graph
        if (!graph) return null
        const inputs = (
          graph as { inputs?: Array<{ name: string; type: string }> }
        ).inputs
        return inputs?.find((i) => i.name.includes('seed'))?.name ?? null
      })
      expect(seedSlotName).not.toBeNull()

      // 4. Right-click the seed input slot and rename it
      await comfyPage.subgraph.rightClickInputSlot(seedSlotName!)
      await comfyPage.contextMenu.clickLitegraphMenuItem('Rename Slot')
      await comfyPage.nextFrame()

      const dialog = SELECTORS.promptDialog
      await page.waitForSelector(dialog, { state: 'visible' })
      await page.fill(dialog, '')
      await page.fill(dialog, RENAMED_LABEL)
      await page.keyboard.press('Enter')
      await page.waitForSelector(dialog, { state: 'hidden' })

      // 5. Navigate back to parent graph and re-enable Vue nodes
      await comfyPage.subgraph.exitViaBreadcrumb()
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.vueNodes.waitForNodes()

      // 6. Verify the widget label updated to the renamed value
      const sgNodeAfter = comfyPage.vueNodes.getNodeLocator('19')
      await comfyExpect(sgNodeAfter).toBeVisible()

      const updatedLabel = await page.evaluate(() => {
        const node = window.app!.canvas.graph!.getNodeById('19')
        if (!node) return null
        const w = node.widgets?.find((w: { name: string }) =>
          w.name.includes('seed')
        )
        return w?.label || w?.name || null
      })
      expect(updatedLabel).toBe(RENAMED_LABEL)

      // 7. Verify the widget is still in the body, not the header
      const seedWidgetAfter = sgNodeAfter.getByLabel('seed', { exact: true })
      await comfyExpect(seedWidgetAfter).toBeVisible()

      await SubgraphHelper.expectWidgetBelowHeader(sgNodeAfter, seedWidgetAfter)
    })
  })

  test.describe('Compressed target_slot', () => {
    test('Can create widget from link with compressed target_slot', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-compressed-target-slot'
      )
      const step = await comfyPage.page.evaluate(() => {
        return window.app!.graph!.nodes[0].widgets![0].options.step
      })
      expect(step).toBe(10)
    })
  })

  test.describe('Slot Alignment', () => {
    /**
     * Regression test for link misalignment on SubgraphNodes when loading
     * workflows with workflowRendererVersion: "LG".
     *
     * Root cause: ensureCorrectLayoutScale scales nodes by 1.2x for LG workflows,
     * and fitView() updates lgCanvas.ds immediately. The Vue TransformPane's CSS
     * transform lags by a frame, causing clientPosToCanvasPos to produce wrong
     * slot offsets. The fix uses DOM-relative measurement instead.
     */
    test('slot positions stay within node bounds after loading LG workflow', async ({
      comfyPage
    }) => {
      const SLOT_BOUNDS_MARGIN = 20
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)

      const workflowPath = resolve(
        import.meta.dirname,
        '../../assets/subgraphs/basic-subgraph.json'
      )
      const workflow = JSON.parse(
        readFileSync(workflowPath, 'utf-8')
      ) as ComfyWorkflowJSON
      workflow.extra = {
        ...workflow.extra,
        workflowRendererVersion: 'LG'
      }

      await comfyPage.page.evaluate(
        (wf) =>
          window.app!.loadGraphData(wf as ComfyWorkflowJSON, true, true, null, {
            openSource: 'template'
          }),
        workflow
      )
      await comfyPage.nextFrame()

      await comfyPage.page.locator('[data-slot-key]').first().waitFor()

      const nodeIds = await comfyPage.page.evaluate(() =>
        window
          .app!.graph._nodes.filter((n) => !!n.isSubgraphNode?.())
          .map((n) => String(n.id))
      )
      expect(nodeIds.length).toBeGreaterThan(0)

      for (const nodeId of nodeIds) {
        const data = await measureNodeSlotOffsets(comfyPage.page, nodeId)
        expect(data, `Node ${nodeId} not found in DOM`).not.toBeNull()
        expectSlotsWithinBounds(data!, SLOT_BOUNDS_MARGIN, `Node ${nodeId}`)
      }
    })
  })

  test.describe('Promoted Slot Position', () => {
    test('Promoted text widget slot is positioned at widget row, not header', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      // Render a few frames so arrange() runs
      await comfyPage.nextFrame()
      await comfyPage.nextFrame()

      const result = await SubgraphHelper.getTextSlotPosition(
        comfyPage.page,
        '11'
      )
      expect(result).not.toBeNull()
      expect(result!.hasPos).toBe(true)

      // The slot Y position should be well below the title area.
      // If it's near 0 or negative, the slot is stuck at the header (the bug).
      expect(result!.posY).toBeGreaterThan(result!.titleHeight)
    })

    test('Slot position remains correct after renaming subgraph input label', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )
      await comfyPage.nextFrame()
      await comfyPage.nextFrame()

      // Verify initial position is correct
      const before = await SubgraphHelper.getTextSlotPosition(
        comfyPage.page,
        '11'
      )
      expect(before).not.toBeNull()
      expect(before!.hasPos).toBe(true)
      expect(before!.posY).toBeGreaterThan(before!.titleHeight)

      // Navigate into subgraph and rename the text input
      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
      await subgraphNode.navigateIntoSubgraph()

      const initialLabel = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph
        if (!graph || !('inputNode' in graph)) return null
        const textInput = graph.inputs?.find(
          (i: { type: string }) => i.type === 'STRING'
        )
        return textInput?.label || textInput?.name || null
      })

      if (!initialLabel)
        throw new Error('Could not find STRING input in subgraph')

      await comfyPage.subgraph.rightClickInputSlot(initialLabel)
      await comfyPage.contextMenu.clickLitegraphMenuItem('Rename Slot')
      await comfyPage.nextFrame()

      const dialog = SELECTORS.promptDialog
      await comfyPage.page.waitForSelector(dialog, { state: 'visible' })
      await comfyPage.page.fill(dialog, '')
      await comfyPage.page.fill(dialog, 'my_custom_prompt')
      await comfyPage.page.keyboard.press('Enter')
      await comfyPage.page.waitForSelector(dialog, { state: 'hidden' })

      // Navigate back to parent graph
      await comfyPage.subgraph.exitViaBreadcrumb()

      // Verify slot position is still at the widget row after rename
      const after = await SubgraphHelper.getTextSlotPosition(
        comfyPage.page,
        '11'
      )
      expect(after).not.toBeNull()
      expect(after!.hasPos).toBe(true)
      expect(after!.posY).toBeGreaterThan(after!.titleHeight)

      // widget.name is the stable identity key — it does NOT change on rename.
      // The display label is on input.label, read via PromotedWidgetView.label.
      expect(after!.widgetName).not.toBe('my_custom_prompt')
    })
  })
})
