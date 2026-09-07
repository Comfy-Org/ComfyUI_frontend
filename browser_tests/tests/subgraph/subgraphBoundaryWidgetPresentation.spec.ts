import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'
import {
  routeObjectInfoFromSetupApi,
  setStringInputTooltip
} from '@e2e/fixtures/utils/objectInfo'
import { toNodeId } from '@/types/nodeId'

test.describe(
  'Subgraph boundary widget presentation',
  { tag: ['@canvas', '@widget', '@vue-nodes', '@subgraph'] },
  () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test.describe('textarea', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )
        await comfyPage.page.evaluate(
          ({ hostId, interiorId }) => {
            const host = window.app!.graph.getNodeById(hostId)
            if (!host?.isSubgraphNode())
              throw new Error('Missing subgraph host')
            const widget = host.subgraph
              .getNodeById(interiorId)
              ?.widgets?.find((widget) => widget.name === 'text')
            if (!widget) throw new Error('Missing interior text widget')
            widget.value = 'Local draft retained behind the boundary'
            window.app!.graph.setDirtyCanvas(true, true)
          },
          { hostId: toNodeId('11'), interiorId: toNodeId('10') }
        )
        await comfyPage.nextFrame()
        await comfyPage.vueNodes.enterSubgraph('11')
        await comfyPage.vueNodes.waitForNodes(2)
      })

      test('keeps the editor mounted and restores its value through disconnect, undo, and redo', async ({
        comfyPage
      }) => {
        const node = comfyPage.vueNodes.getNodeLocator('10')
        const editor = node.getByRole('textbox', { includeHidden: true })
        const indicator = node.getByRole('img', { name: 'text: Linked input' })

        await expect(editor).toBeAttached()
        await expect(editor).toBeHidden()
        await expect(editor).toHaveValue(
          'Local draft retained behind the boundary'
        )
        await expect(indicator).toBeVisible()
        const mountedEditor = await editor.evaluateHandle((element) => element)

        const position = await comfyPage.subgraph
          .getInputSlot('text')
          .getPosition()
        await comfyPage.page.mouse.click(position.x, position.y, {
          button: 'right'
        })
        await comfyPage.contextMenu.clickLitegraphMenuItem('Remove Slot')
        await comfyPage.contextMenu.waitForHidden()
        await comfyPage.nextFrame()

        await expect(editor).toBeAttached()
        await expect(editor).toBeVisible()
        await expect(editor).toHaveValue(
          'Local draft retained behind the boundary'
        )
        expect(
          await mountedEditor.evaluate((element) => element.isConnected)
        ).toBe(true)
        await mountedEditor.dispose()
        await expect(indicator).toHaveCount(0)

        await comfyPage.keyboard.undo()
        await expect(editor).toBeAttached()
        await expect(editor).toBeHidden()
        await expect(editor).toHaveValue(
          'Local draft retained behind the boundary'
        )
        await expect(indicator).toBeVisible()

        await comfyPage.keyboard.redo()
        await expect(editor).toBeAttached()
        await expect(editor).toBeVisible()
        await expect(editor).toHaveValue(
          'Local draft retained behind the boundary'
        )
        await expect(indicator).toHaveCount(0)
      })
    })

    test.describe('help tooltip', () => {
      test.use({ initialSettings: { 'Comfy.EnableTooltips': true } })

      test.beforeEach(async ({ page }) => {
        await routeObjectInfoFromSetupApi(page, (objectInfo) =>
          setStringInputTooltip(
            objectInfo,
            'CLIPTextEncode',
            'text',
            'Describe the image to generate.'
          )
        )
      })

      test.describe('boundary-linked text', () => {
        test.beforeEach(async ({ comfyPage }) => {
          await comfyPage.workflow.loadWorkflow(
            'subgraphs/subgraph-with-promoted-text-widget'
          )
          await comfyPage.page.evaluate(
            ({ hostId, interiorId }) => {
              const host = window.app!.graph.getNodeById(hostId)
              if (!host?.isSubgraphNode())
                throw new Error('Missing subgraph host')
              const widget = host.subgraph
                .getNodeById(interiorId)
                ?.widgets?.find((widget) => widget.name === 'text')
              if (!widget) throw new Error('Missing interior text widget')
              widget.value =
                'A stale local value that must not appear in the tooltip'
              window.app!.graph.setDirtyCanvas(true, true)
            },
            { hostId: toNodeId('11'), interiorId: toNodeId('10') }
          )
          await comfyPage.nextFrame()
          await comfyPage.vueNodes.enterSubgraph('11')
          await comfyPage.vueNodes.waitForNodes(2)
        })

        test('preserves help while omitting the hidden local value', async ({
          comfyPage
        }) => {
          const node = comfyPage.vueNodes.getNodeLocator('10')
          const editor = node.getByRole('textbox', { includeHidden: true })
          const indicator = node.getByRole('img', {
            name: 'text: Linked input'
          })

          await expect(editor).toBeAttached()
          await expect(editor).toBeHidden()
          await expect(editor).toHaveValue(
            'A stale local value that must not appear in the tooltip'
          )
          await indicator.hover()
          await expect(comfyPage.vueNodes.getVisibleWidgetTooltip()).toHaveText(
            'Describe the image to generate.'
          )
        })
      })
    })

    test.describe('boolean switch alignment', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow('widgets/boolean_widget')
        await fitToViewInstant(comfyPage)
        const node = await comfyPage.nodeOps.getNodeRefById('11')
        const host = await node.convertToSubgraph()
        await comfyPage.vueNodes.enterSubgraph(String(host.id))
        await comfyPage.vueNodes.waitForNodes(1)
        await comfyPage.subgraph.promoteWidget(
          comfyPage.vueNodes.getNodeLocator('11'),
          'boolean_input'
        )
        await comfyPage.nextFrame()
      })

      test('centers the linked indicator on the switch track with matching dimensions', async ({
        comfyPage
      }) => {
        const node = comfyPage.vueNodes.getNodeLocator('11')
        const control = node.getByRole('switch', { includeHidden: true })
        const indicator = node.getByRole('img', {
          name: 'boolean_input: Linked input'
        })

        await expect(control).toBeAttached()
        await expect(control).toBeHidden()
        await expect(indicator).toBeVisible()
        await expect(async () => {
          const track = await control.evaluate((element) => {
            const track = element.firstElementChild
            if (!track) throw new Error('Missing switch track')
            const { x, y, width, height } = track.getBoundingClientRect()
            return { x, y, width, height }
          })
          const marker = await indicator.boundingBox()
          if (!marker) throw new Error('Missing linked switch indicator')
          expect(track.width).toBeGreaterThan(0)
          expect(track.height).toBeGreaterThan(0)
          expect(marker.width).toBeCloseTo(track.width, 1)
          expect(marker.height).toBeCloseTo(track.height, 1)
          expect(marker.x + marker.width / 2).toBeCloseTo(
            track.x + track.width / 2,
            1
          )
          expect(marker.y + marker.height / 2).toBeCloseTo(
            track.y + track.height / 2,
            1
          )
        }).toPass({ timeout: 5000 })
      })
    })

    test.describe('ordinary Primitive link', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow('vueNodes/linked-int-widget')
      })

      test('keeps a linked seed value and its auxiliary control visible', async ({
        comfyPage
      }) => {
        const widget = comfyPage.vueNodes.getWidgetRowByLabel(
          'KSampler',
          'seed'
        )
        const controls = comfyPage.vueNodes.getInputNumberControls(widget)
        const node = await comfyPage.nodeOps.getNodeRefById('10')
        const inputSlot = await node.getInput(4)

        await expect.poll(() => inputSlot.getLinkCount()).toBe(1)
        await expect(controls.input).toBeVisible()
        await expect(controls.input).toHaveValue('67')
        await expect(controls.valueControl).toBeVisible()
        await expect(
          widget.getByRole('img', { name: 'seed: Linked input' })
        ).toHaveCount(0)
      })
    })
  }
)
