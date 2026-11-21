import type { NodeId } from '@comfyorg/graph-model/nodeId'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  BLUE,
  PACK_RENDERERS,
  PACK_TAGS,
  RED,
  addPackNode,
  expectPackLoaded,
  keepMixlabOffNodeDrawHooks,
  colourCentre,
  countColour,
  dispatchPackEvent,
  legacyWidgetPoint,
  nodeScreenRect,
  nodeValue,
  showEmptyGraphAtZoomOne,
  uploadSolidImage
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'

const CHOOSER = 'easy imageChooser'
const CONFIRM_LABEL = 'Progress selected image'

async function pauseWithTwoImages(comfyPage: ComfyPage, nodeId: NodeId) {
  await uploadSolidImage(comfyPage, 'n2a_easyuse_a.png', RED)
  await uploadSolidImage(comfyPage, 'n2a_easyuse_b.png', BLUE)
  await dispatchPackEvent(comfyPage, 'easyuse-image-choose', {
    id: Number(nodeId),
    urls: ['n2a_easyuse_a.png', 'n2a_easyuse_b.png'].map((filename) => ({
      filename,
      subfolder: '',
      type: 'input'
    }))
  })
  await expect
    .poll(() => nodeValue(comfyPage, nodeId, ['isWaitingSelection']))
    .toBe(true)
}

async function selectedImages(comfyPage: ComfyPage, nodeId: NodeId) {
  return comfyPage.page.evaluate((id) => {
    const selected: unknown = Reflect.get(
      window.app!.graph.getNodeById(id)!,
      'selected_images'
    )
    return selected instanceof Set ? [...selected] : null
  }, nodeId)
}

async function clickConfirm(comfyPage: ComfyPage, nodeId: NodeId) {
  if (comfyPage.isVueNodes) {
    const button = comfyPage.vueNodes
      .getNodeLocator(nodeId)
      .getByRole('button', { name: CONFIRM_LABEL })
    await expect(button).toBeEnabled()
    await button.click()
    return
  }
  const width = (await nodeValue(comfyPage, nodeId, ['size', '0'])) as number
  const button = await legacyWidgetPoint(
    comfyPage,
    nodeId,
    CONFIRM_LABEL,
    width / 2,
    10
  )
  await comfyPage.page.mouse.click(button.x, button.y)
}

for (const renderer of PACK_RENDERERS) {
  test.describe(
    `ComfyUI-Easy-Use on ${renderer.name}`,
    { tag: [...PACK_TAGS, '@node', ...renderer.tags] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await expectPackLoaded(comfyPage, 'ComfyUI-Easy-Use')
        await keepMixlabOffNodeDrawHooks(comfyPage)
        await showEmptyGraphAtZoomOne(comfyPage)
      })

      test('Image Chooser paused in Always Pause (`easyuse-image-choose` event) lets the user pick an image and confirm it', async ({
        comfyPage
      }) => {
        const id = await addPackNode(comfyPage, CHOOSER, [100, 60], [400, 500])
        await pauseWithTwoImages(comfyPage, id)
        const area = await nodeScreenRect(comfyPage, id)
        await expect(async () => {
          expect(
            await countColour(comfyPage, area, RED),
            'image 1 shown'
          ).toBeGreaterThan(5_000)
          expect(
            await countColour(comfyPage, area, BLUE),
            'image 2 shown'
          ).toBeGreaterThan(5_000)
        }).toPass({ timeout: 10_000 })

        const firstImage = await colourCentre(comfyPage, area, RED)
        await comfyPage.page.mouse.click(firstImage!.x, firstImage!.y)
        await expect.poll(() => selectedImages(comfyPage, id)).toEqual([0])

        const posted = comfyPage.page.waitForRequest(
          (request) =>
            request.url().includes('/easyuse/image_chooser_message') &&
            request.method() === 'POST'
        )
        await clickConfirm(comfyPage, id)

        expect((await posted).postDataJSON()).toMatchObject({
          node_id: id,
          action: 'select',
          selected: [0]
        })
      })
    }
  )
}
