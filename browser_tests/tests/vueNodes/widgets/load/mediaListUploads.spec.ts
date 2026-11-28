import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { AudioPreview } from '@e2e/fixtures/components/AudioPreview'
import { load3dTest } from '@e2e/fixtures/helpers/Load3DFixtures'
import {
  mergeComboInputOptions,
  routeObjectInfoFromSetupApi
} from '@e2e/fixtures/utils/objectInfo'

const FIRST_CLIP = 'media_list_first.wav'
const SECOND_CLIP = 'media_list_second.wav'

const test = load3dTest.extend({
  page: async ({ page }, use) => {
    const unrouteObjectInfo = await routeObjectInfoFromSetupApi(
      page,
      (objectInfo) => {
        mergeComboInputOptions(objectInfo, 'LoadAudio', 'audio', {
          min: 0,
          max: 2
        })
        mergeComboInputOptions(objectInfo, 'Load3D', 'model_file', {
          min: 0,
          max: 2
        })
      }
    )
    try {
      await use(page)
    } finally {
      await unrouteObjectInfo()
    }
  }
})

test.describe(
  'Vue media list uploads',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test('appends dropped clips to a list-valued audio picker and previews the newest', async ({
      comfyPage,
      comfyFiles
    }) => {
      await comfyPage.workflow.loadWorkflow('widgets/load_audio_widget')
      const [loadAudio] = await comfyPage.nodeOps.getNodeRefsByType('LoadAudio')
      await loadAudio.centerOnNode()
      const node = comfyPage.vueNodes.getNodeByTitle('Load Audio')
      const box = await node.boundingBox()
      expect(box, 'Load Audio node should be on screen').not.toBeNull()
      const dropPosition = {
        x: box!.x + box!.width / 2,
        y: box!.y + box!.height / 2
      }
      const audioWidget = await loadAudio.getWidgetByName('audio')
      const preview = new AudioPreview(node).audio

      comfyFiles.deleteAfterTest({ filename: FIRST_CLIP, type: 'input' })
      comfyFiles.deleteAfterTest({ filename: SECOND_CLIP, type: 'input' })
      await comfyPage.dragDrop.dragAndDropGeneratedFile(
        { name: FIRST_CLIP, type: 'audio/wav', byteLength: 1024 },
        { dropPosition, waitForUpload: true }
      )
      await comfyPage.dragDrop.dragAndDropGeneratedFile(
        { name: SECOND_CLIP, type: 'audio/wav', byteLength: 1024 },
        { dropPosition, waitForUpload: true }
      )

      await expect
        .poll(() => audioWidget.getValue())
        .toEqual([FIRST_CLIP, SECOND_CLIP])
      await expect
        .poll(() =>
          preview.evaluate((audio: HTMLAudioElement) =>
            new URL(audio.src).searchParams.get('filename')
          )
        )
        .toBe(SECOND_CLIP)
    })

    test('appends a model dropped on the viewer to a list-valued Load3D picker', async ({
      comfyPage,
      load3d
    }) => {
      const canvasBox = await load3d.canvas.boundingBox()
      expect(canvasBox, 'Canvas bounding box should exist').not.toBeNull()

      await comfyPage.dragDrop.dragAndDropFile('cube.obj', {
        dropPosition: {
          x: canvasBox!.x + canvasBox!.width / 2,
          y: canvasBox!.y + canvasBox!.height / 2
        },
        preserveNativePropagation: true,
        waitForUpload: true
      })

      await load3d.waitForModelLoaded()
      const modelFile = await (
        await comfyPage.nodeOps.getNodeRefById(1)
      ).getWidgetByName('model_file')
      await expect
        .poll(() => modelFile.getValue())
        .toEqual([expect.stringMatching(/^3d\/cube.*\.obj$/)])
    })
  }
)
