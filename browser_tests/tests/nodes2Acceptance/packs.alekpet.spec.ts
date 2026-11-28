import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  PACK_RENDERERS,
  PACK_TAGS,
  addPackNode,
  expectPackLoaded,
  keepMixlabOffNodeDrawHooks,
  graphToClient,
  nodeScreenRect,
  nodeValue,
  padRect,
  showEmptyGraphAtZoomOne
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import {
  contains,
  expectPointOnCanvasOrNode
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks.a2'

import {
  SPEECH_SETTING,
  addIdeNode,
  imageTypeLabelPixels
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks.alekpet'

for (const renderer of PACK_RENDERERS) {
  test.describe(
    `ComfyUI_Custom_Nodes_AlekPet on ${renderer.name}`,
    { tag: [...PACK_TAGS, '@node', ...renderer.tags] },
    () => {
      test.describe('IDE node', () => {
        test.beforeEach(async ({ comfyPage }) => {
          await expectPackLoaded(comfyPage, 'ComfyUI_Custom_Nodes_AlekPet')
          await keepMixlabOffNodeDrawHooks(comfyPage)
          await showEmptyGraphAtZoomOne(comfyPage)
        })

        test('IDE node UPDATE toggle switches off when clicked', async ({
          comfyPage
        }) => {
          const id = await addIdeNode(comfyPage)
          expect(await nodeValue(comfyPage, id, ['toggleEnabled'])).toBe(true)
          const toggleCentre = await comfyPage.page.evaluate((nodeId) => {
            const node = window.app!.graph.getNodeById(nodeId)!
            return [
              node.pos[0] + node.size[0] - 50 + 18,
              node.pos[1] - window.LiteGraph!.NODE_TITLE_HEIGHT + 6 + 9
            ] as const
          }, id)
          const target = await graphToClient(comfyPage, toggleCentre)
          await expectPointOnCanvasOrNode(comfyPage, target, id)

          await comfyPage.page.mouse.click(target.x, target.y)

          await expect
            .poll(() => nodeValue(comfyPage, id, ['toggleEnabled']))
            .toBe(false)
        })

        test('IDE node labels its slots with their types', async ({
          comfyPage
        }) => {
          const id = await addIdeNode(comfyPage)
          const withoutImageInput = await imageTypeLabelPixels(comfyPage, id)
          await comfyPage.page.evaluate((nodeId) => {
            const node = window.app!.graph.getNodeById(nodeId)!
            node.addInput('picture', 'IMAGE')
            window.app!.canvas.setDirty(true, true)
          }, id)

          await expect
            .poll(
              async () =>
                (await imageTypeLabelPixels(comfyPage, id)) - withoutImageInput,
              { message: '[image] type label pixels' }
            )
            .toBeGreaterThan(32)
        })
      })

      test.describe('Speech and recognition', () => {
        test.use({ initialLocalStorage: { [SPEECH_SETTING]: 'true' } })

        test.beforeEach(async ({ comfyPage }) => {
          await expectPackLoaded(comfyPage, 'ComfyUI_Custom_Nodes_AlekPet')
          await keepMixlabOffNodeDrawHooks(comfyPage)
          await showEmptyGraphAtZoomOne(comfyPage)
        })

        test('Speech and recognition buttons overlay the CLIP Text Encode prompt (enabled by its setting)', async ({
          comfyPage
        }) => {
          const id = await addPackNode(
            comfyPage,
            'CLIPTextEncode',
            [300, 150],
            [400, 220]
          )
          const overlay = comfyPage.page.locator(
            '.alekpet_extras_node_speechrecognition_box'
          )
          await expect(overlay).toHaveCount(1)

          await expect(overlay).toBeVisible()
          await expect(async () => {
            const box = await overlay.boundingBox()
            expect(box, 'overlay has a box').not.toBeNull()
            expect(
              contains(padRect(await nodeScreenRect(comfyPage, id), 4), box!),
              'overlay inside the node'
            ).toBe(true)
          }).toPass({ timeout: 10_000 })
        })
      })
    }
  )
}
