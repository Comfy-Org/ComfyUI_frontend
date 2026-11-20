import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'
import { heightOf } from '@e2e/fixtures/utils/locatorBox'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'

test.describe(
  'Subgraph IO widget resize',
  { tag: ['@subgraph', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-two-hosts-three-promoted-widgets'
      )
      await fitToViewInstant(comfyPage)
      await comfyPage.vueNodes.enterSubgraph('12')
      await expect(comfyPage.subgraph.inputWidget('text')).toBeVisible()
    })

    test('dragging a text widget edge in the input panel resizes only that widget and keeps its links on their rows', async ({
      comfyPage,
      comfyMouse
    }) => {
      const { inputPanel } = comfyPage.subgraph
      const text = comfyPage.subgraph.inputWidget('text')
      const text1 = comfyPage.subgraph.inputWidget('text_1')
      const initial = {
        text: await heightOf(text),
        text1: await heightOf(text1),
        panel: await heightOf(inputPanel),
        port: await comfyPage.subgraph.inputPortScreenY('text_1')
      }

      await test.step('Drag the first text widget edge down', async () => {
        await comfyMouse.dragElementBy(
          text.getByTestId('growable-region-handle'),
          { y: 80 }
        )

        await expect
          .poll(() => heightOf(text))
          .toBeCloseTo(initial.text + 80, 0)
        await expect.poll(() => heightOf(text1)).toBeCloseTo(initial.text1, 0)
        await expect
          .poll(() => heightOf(inputPanel))
          .toBeCloseTo(initial.panel + 80, 0)
        await expect
          .poll(() => comfyPage.subgraph.inputPortScreenY('text_1'))
          .toBeCloseTo(initial.port + 80, 0)
      })

      await test.step('Reordering keeps the height with its widget', async () => {
        await comfyMouse.dragElementBy(
          inputPanel.getByRole('button', { name: 'Reorder text', exact: true }),
          { y: initial.text1 + 80 }
        )

        await expect
          .poll(() =>
            inputPanel
              .getByTestId('subgraph-input-port')
              .evaluateAll((ports) =>
                ports
                  .map((port) => port.getAttribute('aria-label'))
                  .filter((label) => label?.startsWith('text'))
              )
          )
          .toEqual(['text_1', 'text', 'text_2'])
        await expect
          .poll(() => heightOf(text))
          .toBeCloseTo(initial.text + 80, 0)
        await expect.poll(() => heightOf(text1)).toBeCloseTo(initial.text1, 0)
      })

      await test.step('Undo returns the widget to its earlier height', async () => {
        await comfyPage.keyboard.undo()
        await comfyPage.keyboard.undo()

        await expect.poll(() => heightOf(text)).toBeCloseTo(initial.text, 0)
        await expect
          .poll(() => heightOf(inputPanel))
          .toBeCloseTo(initial.panel, 0)
      })
    })

    test('a panel resize grows only the widgets the user has not sized', async ({
      comfyPage,
      comfyMouse
    }) => {
      const { inputPanel } = comfyPage.subgraph
      const text = comfyPage.subgraph.inputWidget('text')
      const text1 = comfyPage.subgraph.inputWidget('text_1')
      const text2 = comfyPage.subgraph.inputWidget('text_2')
      const initial = {
        text: await heightOf(text),
        text1: await heightOf(text1),
        text2: await heightOf(text2)
      }
      await comfyMouse.dragElementBy(
        text.getByTestId('growable-region-handle'),
        { y: 60 }
      )
      await expect.poll(() => heightOf(text)).toBeCloseTo(initial.text + 60, 0)

      await comfyMouse.dragElementBy(
        inputPanel.getByRole('button', {
          name: 'Resize from bottom-right corner'
        }),
        { y: 90 }
      )

      await expect.poll(() => heightOf(text)).toBeCloseTo(initial.text + 60, 0)
      await expect
        .poll(() => heightOf(text1))
        .toBeCloseTo(initial.text1 + 45, 0)
      await expect
        .poll(() => heightOf(text2))
        .toBeCloseTo(initial.text2 + 45, 0)
    })

    test('panel and host node widget heights stay independent and both survive save and reload', async ({
      comfyPage,
      comfyMouse
    }) => {
      const panelText = comfyPage.subgraph.inputWidget('text')
      const hostText = () =>
        new VueNodeFixture(comfyPage.vueNodes.getNodeLocator('12')).widgetRow(
          'text'
        )
      const enterHost = async () => {
        await fitToViewInstant(comfyPage)
        await comfyPage.vueNodes.enterSubgraph('12')
        await expect(panelText).toBeVisible()
      }
      const panelInitial = await comfyPage.canvasOps.graphHeightOf(panelText)
      await comfyPage.subgraph.exitViaBreadcrumb()
      await expect(hostText()).toBeVisible()
      const hostInitial = await comfyPage.canvasOps.graphHeightOf(hostText())
      let hostResized = hostInitial
      let panelResized = panelInitial

      await test.step('Resizing on the host node leaves the panel alone', async () => {
        await comfyMouse.dragElementBy(
          hostText().getByTestId('growable-region-handle'),
          { y: 60 }
        )
        hostResized = hostInitial + 60 / (await comfyPage.canvasOps.getScale())
        await expect
          .poll(() => comfyPage.canvasOps.graphHeightOf(hostText()))
          .toBeCloseTo(hostResized, -1)

        await enterHost()
        await expect
          .poll(() => comfyPage.canvasOps.graphHeightOf(panelText))
          .toBeCloseTo(panelInitial, 0)
      })

      await test.step('Resizing in the panel leaves the host node alone', async () => {
        await comfyMouse.dragElementBy(
          panelText.getByTestId('growable-region-handle'),
          { y: 80 }
        )
        panelResized =
          panelInitial + 80 / (await comfyPage.canvasOps.getScale())
        await expect
          .poll(() => comfyPage.canvasOps.graphHeightOf(panelText))
          .toBeCloseTo(panelResized, -1)

        await comfyPage.subgraph.exitViaBreadcrumb()
        await expect
          .poll(() => comfyPage.canvasOps.graphHeightOf(hostText()))
          .toBeCloseTo(hostResized, -1)
      })

      await test.step('Both heights survive saving and reopening the workflow', async () => {
        const workflow = await comfyPage.workflow.getExportedWorkflow()
        await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
        await comfyPage.workflow.loadGraphData(workflow)

        await fitToViewInstant(comfyPage)
        await expect
          .poll(() => comfyPage.canvasOps.graphHeightOf(hostText()))
          .toBeCloseTo(hostResized, -1)
        await enterHost()
        await expect
          .poll(() => comfyPage.canvasOps.graphHeightOf(panelText))
          .toBeCloseTo(panelResized, -1)
      })
    })
  }
)
