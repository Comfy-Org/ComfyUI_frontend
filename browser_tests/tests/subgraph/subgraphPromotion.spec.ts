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

        const ksampler = await comfyPage.nodeOps.getNodeRefById('3')
        await ksampler.click('title')
        const subgraphNode = await ksampler.convertToSubgraph()
        await comfyPage.nextFrame()

        expect(await subgraphNode.exists()).toBe(true)

        const nodeId = String(subgraphNode.id)
        const promotedNames = await getPromotedWidgetNames(comfyPage, nodeId)
        expect(promotedNames).toContain('seed')

        const widgetCount = await getPromotedWidgetCount(comfyPage, nodeId)
        expect(widgetCount).toBeGreaterThan(0)
      })

      test('Preview-capable nodes keep regular and pseudo-widget promotions when converted', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('default')

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

        const nodeBody = subgraphVueNode.locator('[data-testid="node-body-11"]')
        await expect(nodeBody).toBeVisible()

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
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
      })

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
        await comfyPage.canvas.click({
          position: widgetPos,
          button: 'right',
          force: true
        })
        await comfyPage.nextFrame()

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
        const ksampler2 = await comfyPage.nodeOps.getNodeRefById('1')
        await ksampler2.click('title')
        const stepsWidget2 = await ksampler2.getWidget(2)
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
