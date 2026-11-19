import type { Locator } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'
import { heightOf, requireBoundingBox } from '@e2e/fixtures/utils/locatorBox'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'

function widgetRow(panel: Locator, name: string) {
  return panel.locator(`[data-widget-name="${name}"]`)
}

function portScreenY(comfyPage: ComfyPage, name: string) {
  return comfyPage.page.evaluate((name) => {
    const canvas = window.app?.canvas
    const port = canvas?.subgraph?.inputNode.slots.find(
      (slot) => slot.name === name
    )
    if (!canvas || !port) throw new Error(`Expected subgraph input ${name}`)
    return port.pos[1] * canvas.ds.scale
  }, name)
}

function canvasScale(comfyPage: ComfyPage) {
  return comfyPage.page.evaluate(() => window.app?.canvas.ds.scale ?? 1)
}

async function graphHeightOf(comfyPage: ComfyPage, locator: Locator) {
  return (await heightOf(locator)) / (await canvasScale(comfyPage))
}

async function dragBy(comfyPage: ComfyPage, handle: Locator, deltaY: number) {
  await handle.hover()
  const box = await requireBoundingBox(handle)
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await comfyPage.page.mouse.move(x, y)
  await comfyPage.page.mouse.down()
  await comfyPage.page.mouse.move(x, y + deltaY, { steps: 5 })
  await comfyPage.page.mouse.up()
}

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
      await expect(
        widgetRow(comfyPage.subgraph.inputPanel, 'text')
      ).toBeVisible()
    })

    test('dragging a text widget edge in the input panel resizes only that widget and keeps its links on their rows', async ({
      comfyPage
    }) => {
      const { inputPanel } = comfyPage.subgraph
      const text = widgetRow(inputPanel, 'text')
      const text1 = widgetRow(inputPanel, 'text_1')
      const initial = {
        text: await heightOf(text),
        text1: await heightOf(text1),
        panel: await heightOf(inputPanel),
        port: await portScreenY(comfyPage, 'text_1')
      }

      await test.step('Drag the first text widget edge down', async () => {
        await dragBy(comfyPage, text.getByTestId('growable-region-handle'), 80)

        await expect
          .poll(() => heightOf(text))
          .toBeCloseTo(initial.text + 80, 0)
        await expect.poll(() => heightOf(text1)).toBeCloseTo(initial.text1, 0)
        await expect
          .poll(() => heightOf(inputPanel))
          .toBeCloseTo(initial.panel + 80, 0)
        await expect
          .poll(() => portScreenY(comfyPage, 'text_1'))
          .toBeCloseTo(initial.port + 80, 0)
      })

      await test.step('Reordering keeps the height with its widget', async () => {
        await dragBy(
          comfyPage,
          inputPanel.getByRole('button', { name: 'Reorder text', exact: true }),
          initial.text1 + 80
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
      comfyPage
    }) => {
      const { inputPanel } = comfyPage.subgraph
      const text = widgetRow(inputPanel, 'text')
      const text1 = widgetRow(inputPanel, 'text_1')
      const text2 = widgetRow(inputPanel, 'text_2')
      const initial = {
        text: await heightOf(text),
        text1: await heightOf(text1),
        text2: await heightOf(text2)
      }
      await dragBy(comfyPage, text.getByTestId('growable-region-handle'), 60)
      await expect.poll(() => heightOf(text)).toBeCloseTo(initial.text + 60, 0)

      await dragBy(
        comfyPage,
        inputPanel.getByRole('button', {
          name: 'Resize from bottom-right corner'
        }),
        90
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
      comfyPage
    }) => {
      const { inputPanel } = comfyPage.subgraph
      const panelText = widgetRow(inputPanel, 'text')
      const hostText = () =>
        new VueNodeFixture(comfyPage.vueNodes.getNodeLocator('12')).widgetRow(
          'text'
        )
      const enterHost = async () => {
        await fitToViewInstant(comfyPage)
        await comfyPage.vueNodes.enterSubgraph('12')
        await expect(panelText).toBeVisible()
      }
      const panelInitial = await graphHeightOf(comfyPage, panelText)
      await comfyPage.subgraph.exitViaBreadcrumb()
      await expect(hostText()).toBeVisible()
      const hostInitial = await graphHeightOf(comfyPage, hostText())
      let hostResized = hostInitial
      let panelResized = panelInitial

      await test.step('Resizing on the host node leaves the panel alone', async () => {
        await dragBy(
          comfyPage,
          hostText().getByTestId('growable-region-handle'),
          60
        )
        hostResized = hostInitial + 60 / (await canvasScale(comfyPage))
        await expect
          .poll(() => graphHeightOf(comfyPage, hostText()))
          .toBeCloseTo(hostResized, -1)

        await enterHost()
        await expect
          .poll(() => graphHeightOf(comfyPage, panelText))
          .toBeCloseTo(panelInitial, 0)
      })

      await test.step('Resizing in the panel leaves the host node alone', async () => {
        await dragBy(
          comfyPage,
          panelText.getByTestId('growable-region-handle'),
          80
        )
        panelResized = panelInitial + 80 / (await canvasScale(comfyPage))
        await expect
          .poll(() => graphHeightOf(comfyPage, panelText))
          .toBeCloseTo(panelResized, -1)

        await comfyPage.subgraph.exitViaBreadcrumb()
        await expect
          .poll(() => graphHeightOf(comfyPage, hostText()))
          .toBeCloseTo(hostResized, -1)
      })

      await test.step('Both heights survive saving and reopening the workflow', async () => {
        const workflow = await comfyPage.workflow.getExportedWorkflow()
        await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
        await comfyPage.workflow.loadGraphData(workflow)

        await fitToViewInstant(comfyPage)
        await expect
          .poll(() => graphHeightOf(comfyPage, hostText()))
          .toBeCloseTo(hostResized, -1)
        await enterHost()
        await expect
          .poll(() => graphHeightOf(comfyPage, panelText))
          .toBeCloseTo(panelResized, -1)
      })
    })
  }
)
