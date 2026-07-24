import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'
import {
  getPromotedWidgetNames,
  getPromotedWidgetCount
} from '@e2e/fixtures/utils/promotedWidgets'

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

        const clipNode = await comfyPage.nodeOps.getNodeRefById('6')
        await clipNode.click('title')
        const subgraphNode = await clipNode.convertToSubgraph()
        await comfyPage.nextFrame()

        const nodeId = String(subgraphNode.id)
        await expectPromotedWidgetNamesToContain(comfyPage, nodeId, 'text')
      })

      test('SaveImage/PreviewImage nodes get pseudo-widget promoted', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('default')

        const saveNode = await comfyPage.nodeOps.getNodeRefById('9')
        await saveNode.centerOnNode()

        await saveNode.click('title')
        const subgraphNode = await saveNode.convertToSubgraph()
        await comfyPage.nextFrame()

        await expectPromotedWidgetNamesToContain(
          comfyPage,
          String(subgraphNode.id),
          'filename_prefix'
        )
      })
    })

    test.describe(
      'Promoted Widget Visibility in Vue Mode',
      { tag: ['@vue-nodes'] },
      () => {
        test('Promoted text widget renders and enters the subgraph in Vue mode', async ({
          comfyPage
        }) => {
          await comfyPage.workflow.loadWorkflow(
            'subgraphs/subgraph-with-promoted-text-widget'
          )

          const subgraphVueNode = comfyPage.vueNodes.getNodeLocator('11')
          await expect(subgraphVueNode).toBeVisible()

          const enterButton = subgraphVueNode.getByTestId(
            'subgraph-enter-button'
          )
          await expect(enterButton).toBeVisible()

          const nodeBody = subgraphVueNode.getByTestId('node-body-11')
          await expect(nodeBody).toBeVisible()

          const widgets = nodeBody.locator('.lg-node-widgets > div')
          await expect(widgets.first()).toBeVisible()
          await comfyPage.vueNodes.enterSubgraph('11')
          await comfyPage.nextFrame()

          await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)
        })
      }
    )

    test.describe('Promoted Widget Reactivity', { tag: ['@vue-nodes'] }, () => {
      test.fail(
        'Promoted and interior widgets stay in sync across navigation',
        async ({ comfyPage }) => {
          await comfyPage.workflow.loadWorkflow(
            'subgraphs/subgraph-with-promoted-text-widget'
          )

          const testContent = 'promoted-value-sync-test'

          const promotedTextarea = comfyPage.vueNodes
            .getNodeLocator('11')
            .getByRole('textbox', { name: 'text' })
          await promotedTextarea.fill(testContent)

          await comfyPage.vueNodes.enterSubgraph('11')

          const interiorTextarea = comfyPage.page
            .locator('[data-node-id]')
            .getByRole('textbox', { name: 'text' })
            .first()
          await expect(interiorTextarea).toHaveValue(testContent)

          const updatedInteriorContent = 'interior-value-sync-test'
          await interiorTextarea.fill(updatedInteriorContent)

          await comfyPage.subgraph.exitViaBreadcrumb()

          await expect(
            comfyPage.vueNodes
              .getNodeLocator('11')
              .getByRole('textbox', { name: 'text' })
          ).toHaveValue(updatedInteriorContent)
        }
      )
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

        const promoteEntry = comfyPage.page
          .locator('.litemenu-entry')
          .filter({ hasText: /Promote Widget/ })

        await expect(promoteEntry).toBeVisible()
        await promoteEntry.click()
        await expect(promoteEntry).toBeHidden()

        await comfyPage.subgraph.exitViaBreadcrumb()

        await expectPromotedWidgetCountToBeGreaterThan(comfyPage, '2', 0)
      })

      test('Can un-promote a widget from inside a subgraph', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

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

        await comfyPage.vueNodes.enterSubgraph('11')
        await comfyPage.nextFrame()

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

        const saveNode = await comfyPage.nodeOps.getNodeRefById('9')
        await saveNode.centerOnNode()

        await saveNode.click('title')
        const subgraphNode = await saveNode.convertToSubgraph()
        await comfyPage.nextFrame()

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

    test.describe(
      'Nested Promoted Widget Disabled State',
      { tag: ['@vue-nodes'] },
      () => {
        test('Externally linked promotions stay disabled while unlinked textareas remain editable', async ({
          comfyPage
        }) => {
          await comfyPage.workflow.loadWorkflow(
            'subgraphs/subgraph-nested-promotion'
          )

          await expect
            .poll(() => getPromotedWidgetNames(comfyPage, '5'))
            .toEqual(expect.arrayContaining(['string_a', 'value']))

          const subgraphNode = comfyPage.vueNodes.getNodeLocator('5')
          const linkedTextarea = subgraphNode.getByRole('textbox', {
            name: 'string_a',
            exact: true
          })
          await expect(linkedTextarea).toBeVisible()
          await expect(linkedTextarea).toBeDisabled()

          const allTextareas = subgraphNode.getByRole('textbox')
          await expect(allTextareas.first()).toBeVisible()

          let editedTextarea = false
          const count = await allTextareas.count()
          for (let i = 0; i < count; i++) {
            const textarea = allTextareas.nth(i)
            if (await textarea.isEditable()) {
              const testContent = `nested-promotion-edit-${i}`
              await textarea.fill(testContent)
              await expect(textarea).toHaveValue(testContent)
              editedTextarea = true
              break
            }
          }
          expect(editedTextarea).toBe(true)
        })
      }
    )

    test.describe('Promotion Cleanup', () => {
      test('Removing subgraph node clears promotion store entries', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )

        await expect
          .poll(() => getPromotedWidgetNames(comfyPage, '11'))
          .toEqual(expect.arrayContaining([expect.anything()]))

        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
        await subgraphNode.delete()

        await expect.poll(() => subgraphNode.exists()).toBe(false)
      })

      test('Nested promoted widget entries reflect interior changes after slot removal', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-nested-promotion'
        )

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

        await expect
          .poll(() => getPromotedWidgetCount(comfyPage, '11'))
          .toBeGreaterThan(0)
        const initialWidgetCount = await getPromotedWidgetCount(comfyPage, '11')

        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
        await subgraphNode.navigateIntoSubgraph()

        await comfyPage.subgraph.removeSlot('input', 'text')

        await comfyPage.subgraph.exitViaBreadcrumb()

        await expect
          .poll(() => getPromotedWidgetCount(comfyPage, '11'))
          .toBeLessThan(initialWidgetCount)
      })

      test('Does not cleanup unconfigured Primitive', async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-link-and-proxied-primitive'
        )
        await expect
          .poll(
            () => getPromotedWidgetCount(comfyPage, '2'),
            'Primitive widget is restored on load'
          )
          .toBe(2)

        await comfyPage.page.evaluate(() => app!.canvas.setDirty(true))
        const subgraphNode = await comfyPage.nodeOps.getFirstNodeRef()
        const promotedPrimitive = await subgraphNode!.getWidget(1)
        await expect
          .poll(
            () => promotedPrimitive.getValue(),
            'Primitive widget is not in a disconnected state'
          )
          .toBe(0)
      })
    })

    test.fail(
      'Promoted text widget is removed when source node is deleted inside the subgraph',
      { tag: '@vue-nodes' },
      async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')

        const clipFixture = await comfyPage.vueNodes.getFixtureByTitle(
          'CLIP Text Encode (Prompt)'
        )
        await comfyPage.contextMenu.openForVueNode(clipFixture.header)
        await comfyPage.contextMenu.clickMenuItemExact('Convert to Subgraph')

        const subgraphNode = comfyPage.vueNodes
          .getNodeByTitle('New Subgraph')
          .first()
        await expect(subgraphNode).toBeVisible()

        const subgraphNodeId =
          await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')

        await expect
          .poll(() => getPromotedWidgetNames(comfyPage, subgraphNodeId))
          .toContain('text')
        await expect(
          subgraphNode.getByTestId(TestIds.widgets.domWidgetTextarea)
        ).toBeVisible()

        await comfyPage.vueNodes.enterSubgraph(subgraphNodeId)
        await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

        const interiorClip = await comfyPage.vueNodes.getFixtureByTitle(
          'CLIP Text Encode (Prompt)'
        )
        await interiorClip.delete()

        await comfyPage.subgraph.exitViaBreadcrumb()

        const subgraphNodeAfter =
          comfyPage.vueNodes.getNodeLocator(subgraphNodeId)
        await expect(subgraphNodeAfter).toBeVisible()
        await expect(
          subgraphNodeAfter.getByTestId(TestIds.widgets.domWidgetTextarea)
        ).toBeHidden()
      }
    )
  }
)

test(
  'Promote/Demote by Context Menu',
  { tag: ['@vue-nodes'] },
  async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
    const ksampler = comfyPage.vueNodes.getNodeLocator('1')
    const steps = comfyPage.vueNodes.getWidgetByName('New Subgraph', 'steps')
    const subgraphNode = comfyPage.vueNodes.getNodeLocator('2')

    await test.step('Promote widget', async () => {
      await comfyPage.vueNodes.enterSubgraph('2')
      await comfyPage.subgraph.promoteWidget(ksampler, 'steps')
      await comfyPage.subgraph.exitViaBreadcrumb()

      await expect(steps).toBeVisible()
    })

    await test.step('Un-promote widget', async () => {
      await comfyPage.vueNodes.enterSubgraph('2')
      await comfyPage.subgraph.unpromoteWidget(ksampler, 'steps')
      await comfyPage.subgraph.exitViaBreadcrumb()

      await expect(subgraphNode).toBeVisible()
      await expect(steps).toBeHidden()
    })
  }
)

test(
  'Properties panel operations',
  { tag: ['@vue-nodes'] },
  async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
    const { editor } = comfyPage.subgraph
    const subgraphNode = comfyPage.vueNodes.getNodeLocator('2')
    const steps = comfyPage.vueNodes.getWidgetByName('New Subgraph', 'steps')
    const cfg = comfyPage.vueNodes.getWidgetByName('New Subgraph', 'cfg')

    await editor.togglePromotion(subgraphNode, {
      nodeName: 'KSampler',
      widgetName: 'steps',
      toState: true
    })
    await expect(steps, 'Promote widget').toBeVisible()
    await editor.togglePromotion(subgraphNode, {
      nodeName: 'KSampler',
      widgetName: 'cfg',
      toState: true
    })
    await expect(cfg, 'Promote widget').toBeVisible()

    await test.step('widgets display in order promoted', async () => {
      await expect(editor.promotionItems.first()).toContainText('steps')
      await expect(subgraphNode.locator('.lg-node-widget').first()).toHaveText(
        'steps'
      )
    })

    await test.step('Reorder widgets', async () => {
      await editor.dragItem(0, 1)
      await expect(editor.promotionItems.first()).toContainText('cfg')
      await expect(subgraphNode.locator('.lg-node-widget').first()).toHaveText(
        'cfg'
      )
    })

    await comfyPage.vueNodes.enterSubgraph('2')
    const ksampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    await comfyPage.subgraph.unpromoteWidget(ksampler.root, 'steps')
    await comfyPage.subgraph.exitViaBreadcrumb()
    await expect(steps, 'Un-promote widget').toBeHidden()
  }
)

test(
  'Link already promoted widget',
  { tag: ['@vue-nodes'] },
  async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
    const { editor } = comfyPage.subgraph
    const subgraphNode = comfyPage.vueNodes.getNodeLocator('2')
    const steps = comfyPage.vueNodes.getWidgetByName('New Subgraph', 'steps')

    await editor.togglePromotion(subgraphNode, {
      nodeName: 'KSampler',
      widgetName: 'steps',
      toState: true
    })
    await expect(steps, 'Promote widget').toBeVisible()

    await test.step('Enter subgraph and link widget to input', async () => {
      await comfyPage.vueNodes.enterSubgraph('2')
      const ksampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')

      const fromSlot = ksampler.getSlot('steps')
      const toPos = await comfyPage.subgraph
        .getInputSlot()
        .getOpenSlotPosition()
      await fromSlot.dragTo(comfyPage.canvas, { targetPosition: toPos })
      const isConnected = () => comfyPage.vueNodes.isSlotConnected(fromSlot)
      await expect.poll(isConnected).toBe(true)

      await comfyPage.subgraph.exitViaBreadcrumb()
    })

    await expect(steps).toHaveCount(1)
  }
)

test(
  'Can promote multiple previews',
  { tag: ['@vue-nodes'] },
  async ({ comfyPage }) => {
    await comfyPage.menu.topbar.newWorkflowButton.click()
    await comfyPage.nextFrame()

    await test.step('Add and rename a Load Image node', async () => {
      const position = { x: 300, y: 300 }
      await comfyPage.searchBoxV2.addNode('Load Image', { position })
      const loadImage = await comfyPage.vueNodes.getFixtureByTitle('Load Image')
      await loadImage.setTitle('Character Reference')
    })

    await test.step('Add a second Load Image node', async () => {
      const position = { x: 600, y: 300 }
      await comfyPage.searchBoxV2.addNode('Load Image', { position })
    })

    await test.step('Convert both nodes to subgraph', async () => {
      await comfyPage.canvas.focus()
      await comfyPage.page.keyboard.press('Control+a')
      await comfyPage.contextMenu
        .openFor(comfyPage.vueNodes.getNodeLocator('1'))
        .then((m) => m.clickMenuItemExact('Convert to Subgraph'))
    })

    const { editor } = comfyPage.subgraph
    const subgraph = await comfyPage.vueNodes.getFixtureByTitle('New Subgraph')

    await test.step('Promote both image previews', async () => {
      await editor.togglePromotion(subgraph.root, {
        nodeId: '1',
        widgetName: '$$canvas-image-preview',
        toState: true
      })
      await expect(subgraph.content).toHaveCount(1)

      await editor.togglePromotion(subgraph.root, {
        nodeId: '2',
        widgetName: '$$canvas-image-preview',
        toState: true
      })

      await expect(subgraph.content).toHaveCount(2)
    })

    await test.step('Demote image', async () => {
      await editor.togglePromotion(subgraph.root, {
        nodeId: '1',
        widgetName: '$$canvas-image-preview',
        toState: false
      })
      await expect(subgraph.content).toHaveCount(1)
    })
  }
)

test(
  'Linked widgets can not be demoted',
  { tag: ['@vue-nodes'] },
  async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
    const { editor } = comfyPage.subgraph
    const subgraphNode = comfyPage.vueNodes.getNodeLocator('2')

    await test.step('Enter subgraph and link widget to input', async () => {
      await comfyPage.vueNodes.enterSubgraph('2')
      const ksampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')

      const fromSlot = ksampler.getSlot('steps')
      const toPos = await comfyPage.subgraph
        .getInputSlot()
        .getOpenSlotPosition()
      await fromSlot.dragTo(comfyPage.canvas, { targetPosition: toPos })
      const isConnected = () => comfyPage.vueNodes.isSlotConnected(fromSlot)
      await expect.poll(isConnected).toBe(true)

      await comfyPage.subgraph.exitViaBreadcrumb()
    })

    await editor.ensureOpen(subgraphNode)
    const stepsItem = await editor.resolveItem({ widgetName: 'steps' })
    await expect(editor.getToggleButton(stepsItem)).toBeDisabled()
  }
)
