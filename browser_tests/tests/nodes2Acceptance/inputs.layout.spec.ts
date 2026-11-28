import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  RENDERERS,
  addKSamplerWidget,
  ksamplerBodyRect,
  showKSamplerAtZoomOne,
  widgetRow
} from '@e2e/fixtures/helpers/nodes2AcceptanceInputs'

for (const renderer of RENDERERS) {
  test.describe(
    `Node input layout acceptance: ${renderer.name}`,
    { tag: ['@widget', '@node', '@nodes2-acceptance', ...renderer.tags] },
    () => {
      test('consecutive link-only input sockets are 20 px apart', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)
        const pitch = await comfyPage.page.evaluate(() => {
          const node = window.app!.graph.nodes.find(
            (n) => n.type === 'KSampler'
          )!
          const [first, second] = node.inputs
            .map((input, index) => ({ input, index }))
            .filter(({ input }) => !input.widget)
            .map(({ index }) => node.getInputPos(index)[1])
          return second - first
        })

        expect(pitch).toBeCloseTo(20, 0)
      })

      if (renderer.name === 'Nodes 2.0') {
        test('single-line text and labelled toggle rows are 20 px tall', async ({
          comfyPage
        }) => {
          await showKSamplerAtZoomOne(comfyPage)
          await addKSamplerWidget(comfyPage, {
            type: 'text',
            name: 'acceptance_text',
            value: 'text'
          })
          await addKSamplerWidget(comfyPage, {
            type: 'toggle',
            name: 'acceptance_toggle',
            value: false,
            options: { on: 'yes', off: 'no' }
          })

          const text = await widgetRow(comfyPage, 'acceptance_text')
          const toggle = await widgetRow(comfyPage, 'acceptance_toggle')

          expect(text.height, 'text row height').toBeCloseTo(20, 0)
          expect(toggle.height, 'labelled toggle row height').toBeCloseTo(20, 0)
        })

        test('node title text is 14 px', async ({ comfyPage }) => {
          await showKSamplerAtZoomOne(comfyPage)

          const fontSize = await comfyPage.vueNodes
            .getNodeByTitle('KSampler')
            .getByTestId('node-title')
            .evaluate((element) => getComputedStyle(element).fontSize)

          expect(fontSize).toBe('14px')
        })

        test('a node is drawn exactly as tall as its saved size', async ({
          comfyPage
        }) => {
          await showKSamplerAtZoomOne(comfyPage)
          const saved = await ksamplerBodyRect(comfyPage)

          const drawnHeight = (
            await comfyPage.vueNodes
              .getNodeByTitle('KSampler')
              .locator('[data-testid^="node-body-"]')
              .boundingBox()
          )?.height

          expect(drawnHeight).toBeDefined()
          expect(drawnHeight!).toBeCloseTo(saved.height, 0)
        })

        test('widget.last_y is the top of the drawn widget row', async ({
          comfyPage
        }) => {
          await showKSamplerAtZoomOne(comfyPage)
          const row = await widgetRow(comfyPage, 'cfg')
          const reported = await comfyPage.page.evaluate(() => {
            const node = window.app!.graph.nodes.find(
              (n) => n.type === 'KSampler'
            )!
            const widget = node.widgets!.find((w) => w.name === 'cfg')!
            if (widget.last_y === undefined) return undefined
            return window.app!.canvasPosToClientPos([
              node.pos[0],
              node.pos[1] + widget.last_y
            ])[1]
          })

          expect(reported, 'widget.last_y is set').toBeDefined()
          expect(reported!).toBeCloseTo(row.y, 0)
        })
      }
    }
  )
}
