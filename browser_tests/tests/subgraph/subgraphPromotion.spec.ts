import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'
import { TestIds } from '../../fixtures/selectors'
import { fitToViewInstant } from '../../helpers/fitToView'
import {
  getPromotedWidgetNames,
  getPromotedWidgetCount
} from '../../helpers/promotedWidgets'

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

        // Select just the KSampler node (id 3) which has a "seed" widget
        const ksampler = await comfyPage.nodeOps.getNodeRefById('3')
        await ksampler.click('title')
        const subgraphNode = await ksampler.convertToSubgraph()
        await comfyPage.nextFrame()

        // SubgraphNode should exist
        expect(await subgraphNode.exists()).toBe(true)

        // The KSampler has a "seed" widget which is in the recommended list.
        // The promotion store should have at least the seed widget promoted.
        const nodeId = String(subgraphNode.id)
        const promotedNames = await getPromotedWidgetNames(comfyPage, nodeId)
        expect(promotedNames).toContain('seed')

        // SubgraphNode should have widgets (promoted views)
        const widgetCount = await getPromotedWidgetCount(comfyPage, nodeId)
        expect(widgetCount).toBeGreaterThan(0)
      })

      test('Preview-capable nodes keep regular and pseudo-widget promotions when converted', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('default')

        // Pan to SaveImage node (rightmost, may be off-screen in CI)
        const saveNode = await comfyPage.nodeOps.getNodeRefById('9')
        await saveNode.centerOnNode()

        await saveNode.click('title')
        const subgraphNode = await saveNode.convertToSubgraph()
        await comfyPage.nextFrame()

        const promotedNames = await getPromotedWidgetNames(
          comfyPage,
          String(subgraphNode.id)
        )

        expect(promotedNames).toContain('filename_prefix')
        expect(promotedNames.some((name) => name.startsWith('$$'))).toBe(true)
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

        // The subgraph node (id 11) should have a text widget promoted
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

        // SubgraphNode (id 11) should render with its body
        const subgraphVueNode = comfyPage.vueNodes.getNodeLocator('11')
        await expect(subgraphVueNode).toBeVisible()

        // It should have the Enter Subgraph button
        const enterButton = subgraphVueNode.getByTestId('subgraph-enter-button')
        await expect(enterButton).toBeVisible()

        // The promoted text widget should render inside the node
        const nodeBody = subgraphVueNode.locator('[data-testid="node-body-11"]')
        await expect(nodeBody).toBeVisible()

        // Widgets section should exist and have at least one widget
        const widgets = nodeBody.locator('.lg-node-widgets > div')
        await expect(widgets.first()).toBeVisible()
        await comfyPage.vueNodes.enterSubgraph('11')
        await comfyPage.nextFrame()

        expect(await comfyPage.subgraph.isInSubgraph()).toBe(true)
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

        // Type into the promoted textarea on the SubgraphNode
        const textarea = comfyPage.page.getByTestId(
          TestIds.widgets.domWidgetTextarea
        )
        await textarea.fill(testContent)
        await comfyPage.nextFrame()

        // Navigate into subgraph
        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
        await subgraphNode.navigateIntoSubgraph()

        // Interior CLIPTextEncode textarea should have the same value
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
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
      })

      test('Can promote and un-promote a widget from inside a subgraph', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
        await subgraphNode.navigateIntoSubgraph()

        // Get the KSampler node (id 1) inside the subgraph
        const ksampler = await comfyPage.nodeOps.getNodeRefById('1')

        // Right-click on the KSampler's "steps" widget (index 2) to promote it
        const stepsWidget = await ksampler.getWidget(2)
        const widgetPos = await stepsWidget.getPosition()
        await comfyPage.canvas.click({
          position: widgetPos,
          button: 'right',
          force: true
        })
        await comfyPage.nextFrame()

        // Look for the Promote Widget menu entry
        const promoteEntry = comfyPage.page
          .locator('.litemenu-entry')
          .filter({ hasText: /Promote Widget/ })

        await expect(promoteEntry).toBeVisible()
        await promoteEntry.click()
        await comfyPage.nextFrame()

        await comfyPage.subgraph.exitViaBreadcrumb()

        await fitToViewInstant(comfyPage)
        await comfyPage.nextFrame()
        await comfyPage.nextFrame()

        const initialWidgetCount = await getPromotedWidgetCount(comfyPage, '2')
        expect(initialWidgetCount).toBeGreaterThan(0)

        const subgraphNode2 = await comfyPage.nodeOps.getNodeRefById('2')
        await subgraphNode2.navigateIntoSubgraph()
        const stepsWidget2 = await (
          await comfyPage.nodeOps.getNodeRefById('1')
        ).getWidget(2)
        const widgetPos2 = await stepsWidget2.getPosition()

        await comfyPage.canvas.click({
          position: widgetPos2,
          button: 'right',
          force: true
        })
        await comfyPage.nextFrame()

        const unpromoteEntry = comfyPage.page
          .locator('.litemenu-entry')
          .filter({ hasText: /Un-Promote Widget/ })

        await expect(unpromoteEntry).toBeVisible()
        await unpromoteEntry.click()
        await comfyPage.nextFrame()

        await comfyPage.subgraph.exitViaBreadcrumb()

        const finalWidgetCount = await getPromotedWidgetCount(comfyPage, '2')
        expect(finalWidgetCount).toBe(0)
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

        // Navigate into the subgraph (node id 11)
        await comfyPage.vueNodes.enterSubgraph('11')
        await comfyPage.nextFrame()
        await comfyPage.vueNodes.waitForNodes()

        // The interior CLIPTextEncode node (id 10) should render a textarea
        // widget in Vue mode. Right-click it to verify the contextmenu
        // event propagates correctly (fix from PR #9840) and shows the
        // ComfyUI context menu with "Promote Widget".
        const clipNode = comfyPage.vueNodes.getNodeLocator('10')
        await expect(clipNode).toBeVisible()

        // Select the node first so the context menu builds correctly
        await comfyPage.vueNodes.selectNode('10')
        await comfyPage.nextFrame()

        // Dispatch a contextmenu event directly on the textarea. A normal
        // right-click is intercepted by the z-999 canvas overlay, but the
        // Vue WidgetTextarea.vue handler listens on @contextmenu.capture,
        // so dispatching the event directly tests the fix from PR #9840.
        const textarea = clipNode.locator('textarea')
        await expect(textarea).toBeVisible()
        await textarea.dispatchEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2
        })
        await comfyPage.nextFrame()

        // The PrimeVue context menu should show "Promote Widget" since
        // the node is inside a subgraph (not the root graph).
        const promoteEntry = comfyPage.page
          .locator('.p-contextmenu')
          .locator('text=Promote Widget')

        await expect(promoteEntry.first()).toBeVisible({ timeout: 5000 })
      })
    })

    test.describe('Pseudo-Widget Promotion', () => {
      test('Promoted preview nodes render custom content in Vue mode', async ({
        comfyPage
      }) => {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-preview-node'
        )
        await comfyPage.vueNodes.waitForNodes()

        const subgraphVueNode = comfyPage.vueNodes.getNodeLocator('5')
        await expect(subgraphVueNode).toBeVisible()

        const promotedNames = await getPromotedWidgetNames(comfyPage, '5')
        expect(promotedNames).toContain('filename_prefix')
        expect(promotedNames.some((name) => name.startsWith('$$'))).toBe(true)

        const loadImageNode = await comfyPage.nodeOps.getNodeRefById('11')
        const loadImagePosition = await loadImageNode.getPosition()
        await comfyPage.dragDrop.dragAndDropFile('image64x64.webp', {
          dropPosition: loadImagePosition
        })

        await comfyPage.command.executeCommand('Comfy.QueuePrompt')

        const nodeBody = subgraphVueNode.locator('[data-testid="node-body-5"]')
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

        // Node 5 (Sub 0) has 4 promoted widgets. The first (string_a) has its
        // slot connected externally from the Outer node, so it should be
        // disabled. The remaining promoted textarea widgets (value, value_1)
        // are unlinked and should be enabled.
        const promotedNames = await getPromotedWidgetNames(comfyPage, '5')
        expect(promotedNames).toContain('string_a')
        expect(promotedNames).toContain('value')

        const disabledState = await comfyPage.page.evaluate(() => {
          const node = window.app!.canvas.graph!.getNodeById('5')
          return (node?.widgets ?? []).map((w) => ({
            name: w.name,
            disabled: !!w.computedDisabled
          }))
        })

        const linkedWidget = disabledState.find((w) => w.name === 'string_a')
        expect(linkedWidget?.disabled).toBe(true)

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
  }
)
