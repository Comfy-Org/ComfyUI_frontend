import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { fitToViewInstant } from '@e2e/helpers/fitToView'
import {
  getPromotedWidgetNames,
  getPromotedWidgetCount
} from '@e2e/helpers/promotedWidgets'

async function expectPromotedWidgetNamesToContain(
  comfyPage: ComfyPage,
  nodeId: string,
  widgetName: string
) {
  await expect
    .poll(() => getPromotedWidgetNames(comfyPage, nodeId))
    .toContain(widgetName)
}

async function expectPromotedWidgetCountToBeGreaterThan(
  comfyPage: ComfyPage,
  nodeId: string,
  count: number
) {
  await expect
    .poll(() => getPromotedWidgetCount(comfyPage, nodeId))
    .toBeGreaterThan(count)
}

test.describe(
  'Subgraph Widget Promotion',
  { tag: ['@subgraph', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    })

    test.describe('Auto-promotion on Convert to Subgraph', () => {
      test('Recommended widgets are auto-promoted when creating a subgraph', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('default')

        const ksampler = await comfyPage.nodeOps.getNodeRefById('3')
        await ksampler.click('title')
        const subgraphNode = await ksampler.convertToSubgraph()
        await comfyPage.nextFrame()

        await expect.poll(() => subgraphNode.exists()).toBe(true)

        const nodeId = String(subgraphNode.id)
        await expectPromotedWidgetNamesToContain(comfyPage, nodeId, 'seed')

        await expectPromotedWidgetCountToBeGreaterThan(comfyPage, nodeId, 0)
      })

      test('Preview-capable nodes keep regular and pseudo-widget promotions when converted', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('default')

        // Select the positive CLIPTextEncode node (id 6)
        const clipNode = await comfyPage.nodeOps.getNodeRefById('6')
        await clipNode.click('title')
        const subgraphNode = await clipNode.convertToSubgraph()
        await comfyPage.nextFrame()

        const nodeId = String(subgraphNode.id)
        // CLIPTextEncode is in the recommendedNodes list, so its text widget
        // should be promoted
        await expectPromotedWidgetNamesToContain(comfyPage, nodeId, 'text')
      })

      test('SaveImage/PreviewImage nodes get pseudo-widget promoted', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('default')

        // Pan to SaveImage node (rightmost, may be off-screen in CI)
        const saveNode = await comfyPage.nodeOps.getNodeRefById('9')
        await saveNode.centerOnNode()

        await saveNode.click('title')
        const subgraphNode = await saveNode.convertToSubgraph()
        await comfyPage.nextFrame()

        // SaveImage is in the recommendedNodes list, so filename_prefix is promoted
        await expectPromotedWidgetNamesToContain(
          comfyPage,
          String(subgraphNode.id),
          'filename_prefix'
        )
      })
    })

    test.describe('Promoted Widget Visibility in LiteGraph Mode', () => {
      test('Promoted text widget is visible on SubgraphNode', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )
        await comfyPage.nextFrame()

        const textarea = comfyPage.page.getByTestId(
          TestIds.widgets.domWidgetTextarea
        )
        await expect(textarea).toBeVisible()
        await expect(textarea).toHaveCount(1)
      })
    })

    test.describe('Promoted Widget Visibility in Vue Mode', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      })

      test('Promoted text widget renders and enters the subgraph in Vue mode', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )
        await comfyPage.vueNodes.waitForNodes()

        const subgraphVueNode = comfyPage.vueNodes.getNodeLocator('11')
        await expect(subgraphVueNode).toBeVisible()

        const enterButton = subgraphVueNode.getByTestId('subgraph-enter-button')
        await expect(enterButton).toBeVisible()

        const nodeBody = subgraphVueNode.getByTestId('node-body-11')
        await expect(nodeBody).toBeVisible()

        const widgets = nodeBody.locator('.lg-node-widgets > div')
        await expect(widgets.first()).toBeVisible()
        await comfyPage.vueNodes.enterSubgraph('11')
        await comfyPage.nextFrame()

        await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)
      })
    })

    test.describe('Promoted Widget Reactivity', () => {
      test('Promoted and interior widgets stay in sync across navigation', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )
        await comfyPage.nextFrame()

        const testContent = 'promoted-value-sync-test'

        const textarea = comfyPage.page.getByTestId(
          TestIds.widgets.domWidgetTextarea
        )
        await textarea.fill(testContent)
        await comfyPage.nextFrame()

        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
        await subgraphNode.navigateIntoSubgraph()

        const interiorTextarea = comfyPage.page.getByTestId(
          TestIds.widgets.domWidgetTextarea
        )
        await expect(interiorTextarea).toHaveValue(testContent)

        const updatedInteriorContent = 'interior-value-sync-test'
        await interiorTextarea.fill(updatedInteriorContent)
        await comfyPage.nextFrame()

        await comfyPage.subgraph.exitViaBreadcrumb()

        const promotedTextarea = comfyPage.page.getByTestId(
          TestIds.widgets.domWidgetTextarea
        )
        await expect(promotedTextarea).toHaveValue(updatedInteriorContent)
      })
    })

    test.describe('Manual Promote/Demote via Context Menu', () => {
      test('Can promote and un-promote a widget from inside a subgraph', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
        await subgraphNode.navigateIntoSubgraph()

        const ksampler = await comfyPage.nodeOps.getNodeRefById('1')
        await ksampler.click('title')

        const stepsWidget = await ksampler.getWidget(2)
        const widgetPos = await stepsWidget.getPosition()
        await comfyPage.canvasOps.mouseClickAt(widgetPos, { button: 'right' })

        // Look for the Promote Widget menu entry
        const promoteEntry = comfyPage.page
          .locator('.litemenu-entry')
          .filter({ hasText: /Promote Widget/ })

        await expect(promoteEntry).toBeVisible()
        await promoteEntry.click()
        await expect(promoteEntry).toBeHidden()

        // Navigate back to parent
        await comfyPage.subgraph.exitViaBreadcrumb()

        // SubgraphNode should now have the promoted widget
        await expectPromotedWidgetCountToBeGreaterThan(comfyPage, '2', 0)
      })

      test('Can un-promote a widget from inside a subgraph', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

        // First promote a canvas-rendered widget (KSampler "steps")
        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
        await subgraphNode.navigateIntoSubgraph()

        const ksampler = await comfyPage.nodeOps.getNodeRefById('1')
        const stepsWidget = await ksampler.getWidget(2)
        const widgetPos = await stepsWidget.getPosition()

        await comfyPage.canvasOps.mouseClickAt(widgetPos, { button: 'right' })

        const promoteEntry = comfyPage.page
          .locator('.litemenu-entry')
          .filter({ hasText: /Promote Widget/ })

        await expect(promoteEntry).toBeVisible()
        await promoteEntry.click()
        // Wait for the context menu to close, confirming the action completed.
        await expect(promoteEntry).toBeHidden()

        await comfyPage.subgraph.exitViaBreadcrumb()

        await fitToViewInstant(comfyPage)
        await comfyPage.nextFrame()

        await expectPromotedWidgetCountToBeGreaterThan(comfyPage, '2', 0)
        const initialWidgetCount = await getPromotedWidgetCount(comfyPage, '2')

        const subgraphNode2 = await comfyPage.nodeOps.getNodeRefById('2')
        await subgraphNode2.navigateIntoSubgraph()
        const ksampler2 = await comfyPage.nodeOps.getNodeRefById('1')
        await ksampler2.click('title')
        const stepsWidget2 = await ksampler2.getWidget(2)
        const widgetPos2 = await stepsWidget2.getPosition()

        await comfyPage.canvasOps.mouseClickAt(widgetPos2, { button: 'right' })

        const unpromoteEntry = comfyPage.page
          .locator('.litemenu-entry')
          .filter({ hasText: /Un-Promote Widget/ })

        await expect(unpromoteEntry).toBeVisible()
        await unpromoteEntry.click()
        await expect(unpromoteEntry).toBeHidden()

        await comfyPage.subgraph.exitViaBreadcrumb()

        await expect
          .poll(() => getPromotedWidgetCount(comfyPage, '2'))
          .toBeLessThan(initialWidgetCount)
      })
    })

    test.describe('Textarea Widget Context Menu in Subgraph (Vue Mode)', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      })

      test('Right-click on textarea widget inside subgraph shows Promote Widget option', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-text-widget'
        )
        await comfyPage.vueNodes.waitForNodes()

        await comfyPage.vueNodes.enterSubgraph('11')
        await comfyPage.nextFrame()
        await comfyPage.vueNodes.waitForNodes()

        const clipNode = comfyPage.vueNodes.getNodeLocator('10')
        await expect(clipNode).toBeVisible()

        await comfyPage.vueNodes.selectNode('10')
        await comfyPage.nextFrame()

        const textarea = clipNode.locator('textarea')
        await expect(textarea).toBeVisible()
        await textarea.dispatchEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2
        })
        await comfyPage.nextFrame()

        const promoteEntry = comfyPage.page
          .locator('.p-contextmenu')
          .locator('text=Promote Widget')

        await expect(promoteEntry.first()).toBeVisible()
      })
    })

    test.describe('Pseudo-Widget Promotion', () => {
      test('Promoted preview nodes render custom content in Vue mode', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-preview-node'
        )
        await comfyPage.nextFrame()

        // The SaveImage node is in the recommendedNodes list, so its
        // filename_prefix widget should be auto-promoted
        await expectPromotedWidgetNamesToContain(
          comfyPage,
          '5',
          'filename_prefix'
        )
      })

      test('Converting SaveImage to subgraph promotes its widgets', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('default')

        // Pan to SaveImage node (rightmost, may be off-screen in CI)
        const saveNode = await comfyPage.nodeOps.getNodeRefById('9')
        await saveNode.centerOnNode()

        await saveNode.click('title')
        const subgraphNode = await saveNode.convertToSubgraph()
        await comfyPage.nextFrame()

        // SaveImage is a recommended node, so filename_prefix should be promoted
        const nodeId = String(subgraphNode.id)
        await expectPromotedWidgetNamesToContain(
          comfyPage,
          nodeId,
          'filename_prefix'
        )
        await expectPromotedWidgetCountToBeGreaterThan(comfyPage, nodeId, 0)
      })
    })

    test.describe('Vue Mode - Promoted Preview Content', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-preview-node'
        )
        await comfyPage.vueNodes.waitForNodes()

        const subgraphVueNode = comfyPage.vueNodes.getNodeLocator('5')
        await expect(subgraphVueNode).toBeVisible()

        await expect
          .poll(() => getPromotedWidgetNames(comfyPage, '5'))
          .toEqual(
            expect.arrayContaining([
              'filename_prefix',
              expect.stringMatching(/^\$\$/)
            ])
          )

        const loadImageNode = await comfyPage.nodeOps.getNodeRefById('11')
        const loadImagePosition = await loadImageNode.getPosition()
        await comfyPage.dragDrop.dragAndDropFile('image64x64.webp', {
          dropPosition: loadImagePosition
        })

        await comfyPage.command.executeCommand('Comfy.QueuePrompt')

        const nodeBody = subgraphVueNode.getByTestId('node-body-5')
        await expect(nodeBody).toBeVisible()
        await expect(
          nodeBody.locator('.lg-node-widgets > div').first()
        ).toBeVisible()

        await expect(nodeBody.locator('.image-preview img')).toHaveCount(1, {
          timeout: 30_000
        })
        await expect(nodeBody.locator('.lg-node-widgets')).not.toContainText(
          '$$canvas-image-preview'
        )
      })
    })

    test.describe('Nested Promoted Widget Disabled State', () => {
      test('Externally linked promotions stay disabled while unlinked textareas remain editable', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-nested-promotion'
        )
        await comfyPage.nextFrame()

        await expect
          .poll(() => getPromotedWidgetNames(comfyPage, '5'))
          .toEqual(expect.arrayContaining(['string_a', 'value']))

        await expect
          .poll(async () => {
            const disabledState = await comfyPage.page.evaluate(() => {
              const node = window.app!.canvas.graph!.getNodeById('5')
              return (node?.widgets ?? []).map((w) => ({
                name: w.name,
                disabled: !!w.computedDisabled
              }))
            })
            return disabledState.find((w) => w.name === 'string_a')?.disabled
          })
          .toBe(true)

        const textareas = comfyPage.page.getByTestId(
          TestIds.widgets.domWidgetTextarea
        )
        await expect(textareas.first()).toBeVisible()

        let editedTextarea = false
        const count = await textareas.count()
        for (let i = 0; i < count; i++) {
          const textarea = textareas.nth(i)
          const wrapper = textarea.locator('..')
          const opacity = await wrapper.evaluate(
            (el) => getComputedStyle(el).opacity
          )

          if (opacity === '1' && (await textarea.isEditable())) {
            const testContent = `nested-promotion-edit-${i}`
            await textarea.fill(testContent)
            await expect(textarea).toHaveValue(testContent)
            editedTextarea = true
            break
          }
        }
        expect(editedTextarea).toBe(true)
      })
    })

    test.describe('Promotion Cleanup', () => {
      test('Removing subgraph node clears promotion store entries', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )
        await comfyPage.nextFrame()

        // Verify promotions exist
        await expect
          .poll(() => getPromotedWidgetNames(comfyPage, '11'))
          .toEqual(expect.arrayContaining([expect.anything()]))

        // Delete the subgraph node
        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
        await subgraphNode.delete()

        // Node no longer exists, so promoted widgets should be gone
        await expect.poll(() => subgraphNode.exists()).toBe(false)
      })

      test('Nested promoted widget entries reflect interior changes after slot removal', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-nested-promotion'
        )
        await comfyPage.nextFrame()

        await expectPromotedWidgetCountToBeGreaterThan(comfyPage, '5', 0)
        const initialNames = await getPromotedWidgetNames(comfyPage, '5')

        const outerSubgraph = await comfyPage.nodeOps.getNodeRefById('5')
        await outerSubgraph.navigateIntoSubgraph()

        await expect
          .poll(async () => {
            return await comfyPage.page.evaluate(() => {
              const graph = window.app!.canvas.graph
              if (!graph || !('inputNode' in graph)) return null
              return graph.inputs?.[0]?.name ?? null
            })
          })
          .not.toBeNull()
        const removedSlotName = await comfyPage.page.evaluate(() => {
          const graph = window.app!.canvas.graph
          if (!graph || !('inputNode' in graph)) return null
          return graph.inputs?.[0]?.name ?? null
        })

        await comfyPage.subgraph.removeSlot('input')

        await comfyPage.subgraph.exitViaBreadcrumb()

        const expectedNames = [...initialNames]
        const removedIndex = expectedNames.indexOf(removedSlotName!)
        expect(removedIndex).toBeGreaterThanOrEqual(0)
        expectedNames.splice(removedIndex, 1)

        await expect
          .poll(() => getPromotedWidgetNames(comfyPage, '5'))
          .toEqual(expectedNames)
      })

      test('Removing I/O slot removes associated promoted widget', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )

        let initialWidgetCount = 0
        await expect
          .poll(() => getPromotedWidgetCount(comfyPage, '11'))
          .toBeGreaterThan(0)
        initialWidgetCount = await getPromotedWidgetCount(comfyPage, '11')

        // Navigate into subgraph
        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
        await subgraphNode.navigateIntoSubgraph()

        // Remove the text input slot
        await comfyPage.subgraph.removeSlot('input', 'text')

        // Navigate back via breadcrumb
        await comfyPage.subgraph.exitViaBreadcrumb()

        // Widget count should be reduced
        await expect
          .poll(() => getPromotedWidgetCount(comfyPage, '11'))
          .toBeLessThan(initialWidgetCount)
      })
    })
  }
)
