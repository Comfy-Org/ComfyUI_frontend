import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  PACK_RENDERERS,
  PACK_TAGS,
  addPackNode,
  dispatchExecuted,
  expectPackLoaded,
  keepMixlabOffNodeDrawHooks,
  inputImage,
  legacyWidgetPoint,
  redrawCanvas,
  showEmptyGraphAtZoomOne,
  widgetState
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import {
  expectPointOnCanvasOrNode,
  uploadToneWav
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks.a2'

const MAGIC_LORA = 'Magic LoRA Loader'
const YUE = 'YuEMusicGenerator'
const WET = 'wet'

for (const renderer of PACK_RENDERERS) {
  test.describe(
    `CRT-Nodes on ${renderer.name}`,
    { tag: [...PACK_TAGS, '@node', ...renderer.tags] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await expectPackLoaded(comfyPage, 'CRT-Nodes')
        await keepMixlabOffNodeDrawHooks(comfyPage)
        await showEmptyGraphAtZoomOne(comfyPage)
      })

      test('Magic LoRA Loader Dry / Wet steps up when its + arrow is clicked', async ({
        comfyPage
      }) => {
        const id = await addPackNode(
          comfyPage,
          MAGIC_LORA,
          [150, 100],
          [460, 300]
        )
        await expect
          .poll(async () => {
            await redrawCanvas(comfyPage)
            return widgetState(comfyPage, id, WET, [
              'hitAreas',
              'inc',
              'bounds',
              '1'
            ])
          })
          .toBeGreaterThan(0)
        expect(await widgetState(comfyPage, id, WET, ['value', 'value'])).toBe(
          1
        )
        const [x, width] = (await widgetState(comfyPage, id, WET, [
          'hitAreas',
          'inc',
          'bounds'
        ])) as number[]
        const increment = await legacyWidgetPoint(
          comfyPage,
          id,
          WET,
          x + width / 2,
          10
        )
        await expectPointOnCanvasOrNode(comfyPage, increment, id)

        await comfyPage.page.mouse.click(increment.x, increment.y)
        await expect
          .poll(() => widgetState(comfyPage, id, WET, ['value', 'value']))
          .toBeCloseTo(1.05, 5)
        await comfyPage.page.mouse.click(increment.x, increment.y)
        await expect
          .poll(() => widgetState(comfyPage, id, WET, ['value', 'value']))
          .toBeCloseTo(1.1, 5)
      })

      test('YuE Music Generator loads its run output (delivered by an `executed` message)', async ({
        comfyPage,
        comfyFiles
      }) => {
        const audio = await uploadToneWav(
          comfyPage,
          comfyFiles,
          'n2a_crt_tone.wav'
        )
        const id = await addPackNode(comfyPage, YUE, [100, 50], [900, 900])
        const peak = comfyPage.page.locator('.yue-metric-val[data-id="peak"]')
        await expect(peak).toHaveText('--')

        await dispatchExecuted(comfyPage, id, {
          audio: [inputImage(audio)],
          metrics: [{ peak: '-3.2', rms: '-12.5' }],
          style: ['n2a style'],
          lyrics: ['n2a lyrics']
        })

        await expect(peak).toHaveText('-3.2 dB')
        await expect(comfyPage.page.locator('.yue-gen-text')).toHaveText(
          'Generate Again'
        )
      })
    }
  )
}
