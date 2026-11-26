import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  MAGENTA,
  PACK_RENDERERS,
  PACK_TAGS,
  RED,
  addPackNode,
  countColour,
  dispatchExecuted,
  expectPackLoaded,
  keepMixlabOffNodeDrawHooks,
  nodeScreenRect,
  padRect,
  showEmptyGraphAtZoomOne
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import { countColourInImage } from '@e2e/fixtures/helpers/nodes2AcceptancePacks.a2'
import {
  exportWorkflowPng,
  textAreaOf
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks.customScripts'

const MATH_EXPRESSION = 'MathExpression|pysssss'
const PRESET_TEXT = 'PresetText|pysssss'
const DODGER_BLUE = [30, 144, 255] as const
const MATH_RESULT = 987654321

for (const renderer of PACK_RENDERERS) {
  test.describe(
    `ComfyUI-Custom-Scripts on ${renderer.name}`,
    { tag: [...PACK_TAGS, '@node', ...renderer.tags] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await expectPackLoaded(comfyPage, 'ComfyUI-Custom-Scripts')
        await keepMixlabOffNodeDrawHooks(comfyPage)
        await showEmptyGraphAtZoomOne(comfyPage)
      })

      test('Workflow Image export (PNG) contains the nodes of the graph', async ({
        comfyPage
      }) => {
        const id = await addPackNode(
          comfyPage,
          'EmptyLatentImage',
          [200, 200],
          [400, 200]
        )
        await comfyPage.page.evaluate((nodeId) => {
          window.app!.graph.getNodeById(nodeId)!.bgcolor = '#ff00ff'
          window.app!.canvas.setDirty(true, true)
        }, id)
        await comfyPage.nextFrame()

        const png = await exportWorkflowPng(comfyPage)

        expect(
          png.includes(Buffer.from('tEXtworkflow')),
          'workflow embedded in the PNG'
        ).toBe(true)
        expect(
          await countColourInImage(comfyPage, png, MAGENTA),
          'node body pixels in the exported image'
        ).toBeGreaterThan(20_000)
      })

      test('Math Expression shows its result (run output delivered by an `executed` message)', async ({
        comfyPage
      }) => {
        const id = await addPackNode(
          comfyPage,
          MATH_EXPRESSION,
          [200, 200],
          [400, 200]
        )
        const area = padRect(await nodeScreenRect(comfyPage, id), 4)
        const blueBefore = await countColour(comfyPage, area, DODGER_BLUE)

        await dispatchExecuted(comfyPage, id, { value: [MATH_RESULT] })

        if (comfyPage.isVueNodes) {
          await expect(
            comfyPage.vueNodes.getNodeLocator(id).getByText(String(MATH_RESULT))
          ).toBeVisible()
        } else {
          await expect
            .poll(
              async () =>
                (await countColour(comfyPage, area, DODGER_BLUE)) - blueBefore,
              { message: 'result readout visible on the node' }
            )
            .toBeGreaterThan(60)
        }
      })

      test('Autocomplete offers words while typing in a prompt box', async ({
        comfyPage
      }) => {
        const id = await addPackNode(
          comfyPage,
          'CLIPTextEncode',
          [200, 200],
          [400, 200]
        )
        const textArea = await textAreaOf(comfyPage, id)
        await textArea.click()
        await comfyPage.page.keyboard.type('embed')

        await expect(
          comfyPage.page
            .locator('.pysssss-autocomplete')
            .filter({ hasText: 'embedding:' })
        ).toBeVisible()
      })

      test('Preset Text marks itself red when its preset is missing at queue time', async ({
        comfyPage
      }) => {
        const presetId = await addPackNode(
          comfyPage,
          PRESET_TEXT,
          [100, 200],
          [260, 90]
        )
        const encodeId = await addPackNode(
          comfyPage,
          'CLIPTextEncode',
          [500, 200],
          [400, 200]
        )
        await comfyPage.page.evaluate(
          ({ presetId, encodeId }) => {
            const graph = window.app!.graph
            const preset = graph.getNodeById(presetId)!
            const encode = graph.getNodeById(encodeId)!
            preset.connect(0, encode, encode.findInputSlot('text'))
            preset.widgets![0].value = 'n2a missing preset'
            window.app!.canvas.setDirty(true, true)
          },
          { presetId, encodeId }
        )
        await comfyPage.nextFrame()
        const area = padRect(await nodeScreenRect(comfyPage, presetId), 4)
        const redBefore = await countColour(comfyPage, area, RED)

        const queueError = await comfyPage.page.evaluate(() =>
          window.app!.graphToPrompt().then(
            () => '',
            (error: unknown) => String(error)
          )
        )
        expect(queueError).toContain('n2a missing preset')

        await expect
          .poll(
            async () => (await countColour(comfyPage, area, RED)) - redBefore,
            { message: 'red warning pixels on the Preset Text node' }
          )
          .toBeGreaterThan(2_400)
      })
    }
  )
}
