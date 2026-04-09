import { readFileSync } from 'fs'
import { resolve } from 'path'

import { expect } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { SubgraphHelper } from '@e2e/fixtures/helpers/SubgraphHelper'
import {
  expectSlotsWithinBounds,
  measureNodeSlotOffsets
} from '@e2e/fixtures/utils/slotBoundsUtil'

const RENAMED_INPUT_NAME = 'renamed_input'
const RENAMED_SLOT_NAME = 'renamed_slot_name'
const SECOND_RENAMED_NAME = 'second_renamed_name'
const RENAMED_LABEL = 'my_seed'

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

  test.describe('I/O Slot Management', () => {
    test('Can add input slots to subgraph', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialCount = await comfyPage.subgraph.getSlotCount('input')
      const vaeEncodeNodes = await comfyPage.nodeOps.getNodeRefsByType(
        'VAEEncode',
        true
      )
      expect(
        vaeEncodeNodes.length,
        'Expected at least one VAEEncode node'
      ).toBeGreaterThan(0)
      const [vaeEncodeNode] = vaeEncodeNodes

      await comfyPage.subgraph.connectFromInput(vaeEncodeNode, 0)
      await comfyPage.nextFrame()

      await expect
        .poll(() => comfyPage.subgraph.getSlotCount('input'))
        .toBe(initialCount + 1)
    })

    test('Can add output slots to subgraph', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialCount = await comfyPage.subgraph.getSlotCount('output')
      const vaeEncodeNodes = await comfyPage.nodeOps.getNodeRefsByType(
        'VAEEncode',
        true
      )
      expect(
        vaeEncodeNodes.length,
        'Expected at least one VAEEncode node'
      ).toBeGreaterThan(0)
      const [vaeEncodeNode] = vaeEncodeNodes

      await comfyPage.subgraph.connectToOutput(vaeEncodeNode, 0)
      await comfyPage.nextFrame()

      await expect
        .poll(() => comfyPage.subgraph.getSlotCount('output'))
        .toBe(initialCount + 1)
    })

    test('Can remove input slots from subgraph', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialCount = await comfyPage.subgraph.getSlotCount('input')
      expect(initialCount).toBeGreaterThan(0)

      await comfyPage.subgraph.removeSlot('input')
      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()

      await expect
        .poll(() => comfyPage.subgraph.getSlotCount('input'))
        .toBe(initialCount - 1)
    })

    test('Can remove output slots from subgraph', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialCount = await comfyPage.subgraph.getSlotCount('output')
      expect(initialCount).toBeGreaterThan(0)

      await comfyPage.subgraph.removeSlot('output')
      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()

      await expect
        .poll(() => comfyPage.subgraph.getSlotCount('output'))
        .toBe(initialCount - 1)
    })

    test('Can rename an input slot from the context menu', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialInputLabel = await comfyPage.subgraph.getSlotLabel('input')

      await comfyPage.subgraph.rightClickInputSlot(initialInputLabel!)
      await comfyPage.contextMenu.clickLitegraphMenuItem('Rename Slot')
      await comfyPage.nextFrame()

      await expect(comfyPage.page.locator(SELECTORS.promptDialog)).toBeVisible()
      await comfyPage.page.fill(SELECTORS.promptDialog, RENAMED_INPUT_NAME)
      await comfyPage.page.keyboard.press('Enter')

      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()

      await expect
        .poll(() => comfyPage.subgraph.getSlotLabel('input'))
        .toBe(RENAMED_INPUT_NAME)
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

      await expect
        .poll(() => comfyPage.subgraph.getSlotLabel('input'))
        .toBe(RENAMED_INPUT_NAME)
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

      await expect
        .poll(() => comfyPage.subgraph.getSlotLabel('output'))
        .toBe(renamedOutputName)
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

      await expect
        .poll(() => comfyPage.subgraph.getSlotLabel('input'))
        .toBe(rightClickRenamedName)
    })

    test('Can double-click on slot label text to rename', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      // Use direct pointer event approach to double-click on label
      await comfyPage.page.evaluate(() => {
        const app = window.app!
        const graph = app.canvas.graph
        if (!graph || !('inputNode' in graph))
          throw new Error('Expected to be in subgraph')

        const input = graph.inputs?.[0]
        if (!input?.labelPos)
          throw new Error('Could not get label position for testing')

        const leftClickEvent = {
          canvasX: input.labelPos[0],
          canvasY: input.labelPos[1],
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

          if (app.canvas.pointer.onDoubleClick) {
            app.canvas.pointer.onDoubleClick(leftClickEvent)
          }
        }
      })

      await comfyPage.nextFrame()

      await expect(comfyPage.page.locator(SELECTORS.promptDialog)).toBeVisible()
      const labelClickRenamedName = 'label_click_renamed'
      await comfyPage.page.fill(SELECTORS.promptDialog, labelClickRenamedName)
      await comfyPage.page.keyboard.press('Enter')

      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()

      await expect
        .poll(() => comfyPage.subgraph.getSlotLabel('input'))
        .toBe(labelClickRenamedName)
    })
  })

  test.describe('Subgraph Slot Rename Dialog', () => {
    test('Shows current slot label (not stale) in rename dialog', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialInputLabel = await comfyPage.subgraph.getSlotLabel('input')
      if (initialInputLabel === null) {
        throw new Error(
          'Expected subgraph to have an input slot label for rightClickInputSlot'
        )
      }

      await comfyPage.subgraph.rightClickInputSlot(initialInputLabel)
      await comfyPage.contextMenu.clickLitegraphMenuItem('Rename Slot')
      await comfyPage.nextFrame()

      await expect(comfyPage.page.locator(SELECTORS.promptDialog)).toBeVisible()
      await comfyPage.page.fill(SELECTORS.promptDialog, '')
      await comfyPage.page.fill(SELECTORS.promptDialog, RENAMED_SLOT_NAME)
      await comfyPage.page.keyboard.press('Enter')

      await expect(comfyPage.page.locator(SELECTORS.promptDialog)).toBeHidden()

      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const graph = window.app!.canvas.graph
            if (!graph || !('inputNode' in graph)) return null
            return graph.inputs?.[0]?.label || null
          })
        )
        .toBe(RENAMED_SLOT_NAME)

      await comfyPage.subgraph.rightClickInputSlot()
      await comfyPage.contextMenu.clickLitegraphMenuItem('Rename Slot')
      await comfyPage.nextFrame()

      await expect(comfyPage.page.locator(SELECTORS.promptDialog)).toBeVisible()

      await expect(comfyPage.page.locator(SELECTORS.promptDialog)).toHaveValue(
        RENAMED_SLOT_NAME
      )

      await comfyPage.page.fill(SELECTORS.promptDialog, '')
      await comfyPage.page.fill(SELECTORS.promptDialog, SECOND_RENAMED_NAME)
      await comfyPage.page.keyboard.press('Enter')

      await expect(comfyPage.page.locator(SELECTORS.promptDialog)).toBeHidden()

      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()

      await expect
        .poll(() => comfyPage.subgraph.getSlotLabel('input'))
        .toBe(SECOND_RENAMED_NAME)
    })

    test('Shows current output slot label in rename dialog', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialOutputLabel = await comfyPage.subgraph.getSlotLabel('output')
      if (initialOutputLabel === null) {
        throw new Error(
          'Expected subgraph to have an output slot label for rightClickOutputSlot'
        )
      }

      await comfyPage.subgraph.rightClickOutputSlot(initialOutputLabel)
      await comfyPage.contextMenu.clickLitegraphMenuItem('Rename Slot')
      await comfyPage.nextFrame()

      await expect(comfyPage.page.locator(SELECTORS.promptDialog)).toBeVisible()
      await comfyPage.page.fill(SELECTORS.promptDialog, '')
      await comfyPage.page.fill(SELECTORS.promptDialog, RENAMED_SLOT_NAME)
      await comfyPage.page.keyboard.press('Enter')

      await expect(comfyPage.page.locator(SELECTORS.promptDialog)).toBeHidden()

      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()

      await comfyPage.subgraph.rightClickOutputSlot()
      await comfyPage.contextMenu.clickLitegraphMenuItem('Rename Slot')
      await comfyPage.nextFrame()

      await expect(comfyPage.page.locator(SELECTORS.promptDialog)).toBeVisible()

      await expect(comfyPage.page.locator(SELECTORS.promptDialog)).toHaveValue(
        RENAMED_SLOT_NAME
      )
    })
  })

  test.describe('Subgraph input slot rename propagation', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    })

    test('Renaming a subgraph input slot updates the widget label on the parent node', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/test-values-input-subgraph'
      )
      await comfyPage.vueNodes.waitForNodes()

      const subgraphNode = comfyPage.vueNodes.getNodeLocator('19')
      await expect(subgraphNode).toBeVisible()

      const seedWidget = subgraphNode.getByLabel('seed', { exact: true })
      await expect(seedWidget).toBeVisible()
      await SubgraphHelper.expectWidgetBelowHeader(subgraphNode, seedWidget)

      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await comfyPage.nextFrame()

      const subgraphNodeRef = await comfyPage.nodeOps.getNodeRefById('19')
      await subgraphNodeRef.navigateIntoSubgraph()

      await expect
        .poll(async () => {
          return await comfyPage.page.evaluate(() => {
            const graph = window.app!.canvas.graph
            if (!graph) return null
            const inputs = (graph as { inputs?: Array<{ name: string }> })
              .inputs
            return (
              inputs?.find((input) => input.name.includes('seed'))?.name ?? null
            )
          })
        })
        .not.toBeNull()
      const seedSlotName = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph
        if (!graph) return null
        const inputs = (graph as { inputs?: Array<{ name: string }> }).inputs
        return (
          inputs?.find((input) => input.name.includes('seed'))?.name ?? null
        )
      })

      await comfyPage.subgraph.rightClickInputSlot(seedSlotName!)
      await comfyPage.contextMenu.clickLitegraphMenuItem('Rename Slot')
      await comfyPage.nextFrame()

      await expect(comfyPage.page.locator(SELECTORS.promptDialog)).toBeVisible()
      await comfyPage.page.fill(SELECTORS.promptDialog, '')
      await comfyPage.page.fill(SELECTORS.promptDialog, RENAMED_LABEL)
      await comfyPage.page.keyboard.press('Enter')
      await expect(comfyPage.page.locator(SELECTORS.promptDialog)).toBeHidden()

      await comfyPage.subgraph.exitViaBreadcrumb()
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.vueNodes.waitForNodes()

      const subgraphNodeAfter = comfyPage.vueNodes.getNodeLocator('19')
      await expect(subgraphNodeAfter).toBeVisible()

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const node = window.app!.canvas.graph!.getNodeById('19')
            if (!node) return null
            const widget = node.widgets?.find((entry: { name: string }) =>
              entry.name.includes('seed')
            )
            return widget?.label || widget?.name || null
          })
        )
        .toBe(RENAMED_LABEL)

      const seedWidgetAfter = subgraphNodeAfter.getByLabel('seed', {
        exact: true
      })
      await expect(seedWidgetAfter).toBeVisible()
      await expect(
        subgraphNodeAfter.getByText(RENAMED_LABEL, { exact: true })
      ).toBeVisible()
      await SubgraphHelper.expectWidgetBelowHeader(
        subgraphNodeAfter,
        seedWidgetAfter
      )
    })
  })

  test.describe('Subgraph promoted widget-input slot position', () => {
    test('Promoted text widget slot is positioned at widget row, not header', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      await expect
        .poll(async () => {
          const result = await SubgraphHelper.getTextSlotPosition(
            comfyPage.page,
            '11'
          )
          return result?.hasPos && result.posY! > result.titleHeight
        })
        .toBe(true)
    })

    test('Slot position remains correct after renaming subgraph input label', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      await expect
        .poll(async () => {
          const result = await SubgraphHelper.getTextSlotPosition(
            comfyPage.page,
            '11'
          )
          return result?.hasPos && result.posY! > result.titleHeight
        })
        .toBe(true)

      const before = await SubgraphHelper.getTextSlotPosition(
        comfyPage.page,
        '11'
      )

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
      await subgraphNode.navigateIntoSubgraph()

      const initialLabel = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph
        if (!graph || !('inputNode' in graph)) return null
        const textInput = graph.inputs?.find(
          (input: { type: string }) => input.type === 'STRING'
        )
        return textInput?.label || textInput?.name || null
      })
      if (!initialLabel)
        throw new Error('Could not find STRING input in subgraph')

      await comfyPage.subgraph.rightClickInputSlot(initialLabel)
      await comfyPage.contextMenu.clickLitegraphMenuItem('Rename Slot')
      await comfyPage.nextFrame()

      await expect(comfyPage.page.locator(SELECTORS.promptDialog)).toBeVisible()
      await comfyPage.page.fill(SELECTORS.promptDialog, '')
      await comfyPage.page.fill(SELECTORS.promptDialog, 'my_custom_prompt')
      await comfyPage.page.keyboard.press('Enter')
      await expect(comfyPage.page.locator(SELECTORS.promptDialog)).toBeHidden()

      await comfyPage.subgraph.exitViaBreadcrumb()

      await expect
        .poll(async () => {
          const result = await SubgraphHelper.getTextSlotPosition(
            comfyPage.page,
            '11'
          )
          return (
            result?.hasPos &&
            result.posY! > result.titleHeight &&
            result.widgetName === before!.widgetName
          )
        })
        .toBe(true)
    })
  })

  test.describe('Subgraph slot alignment after LG layout scale', () => {
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

      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            () =>
              window.app!.graph._nodes.filter((n) => !!n.isSubgraphNode?.())
                .length
          )
        )
        .toBeGreaterThan(0)

      const nodeIds = await comfyPage.page.evaluate(() =>
        window
          .app!.graph._nodes.filter((n) => !!n.isSubgraphNode?.())
          .map((n) => String(n.id))
      )

      for (const nodeId of nodeIds) {
        await expect
          .poll(
            async () => await measureNodeSlotOffsets(comfyPage.page, nodeId)
          )
          .not.toBeNull()
        const data = await measureNodeSlotOffsets(comfyPage.page, nodeId)
        expectSlotsWithinBounds(data!, SLOT_BOUNDS_MARGIN, `Node ${nodeId}`)
      }
    })
  })
})
