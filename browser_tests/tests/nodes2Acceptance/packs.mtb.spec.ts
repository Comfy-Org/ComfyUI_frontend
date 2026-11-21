import type { NodeId } from '@comfyorg/graph-model/nodeId'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  PACK_RENDERERS,
  PACK_TAGS,
  addPackNode,
  countColour,
  expectPackLoaded,
  keepMixlabOffNodeDrawHooks,
  nodeScreenRect,
  showEmptyGraphAtZoomOne
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import {
  nodeLocalPoint,
  nodeLocalRect
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks.a1'

const NOTE_PLUS = 'Note Plus (mtb)'
const STACK_IMAGES = 'Stack Images (mtb)'
const EDIT_ICON_STROKE_ON_NOTE_TITLE = [143, 133, 122] as const

async function editIconRect(comfyPage: ComfyPage, id: NodeId) {
  return comfyPage.page.evaluate((nodeId) => {
    const node = window.app!.graph.getNodeById(nodeId)!
    const rect: Record<'x' | 'y' | 'width' | 'height', number> = Reflect.get(
      node,
      'iconRect'
    )
    return [rect.x, rect.y, rect.width, rect.height] as const
  }, id)
}

for (const renderer of PACK_RENDERERS) {
  test.describe(
    `comfy_mtb on ${renderer.name}`,
    { tag: [...PACK_TAGS, '@node', ...renderer.tags] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await keepMixlabOffNodeDrawHooks(comfyPage)
        await expectPackLoaded(comfyPage, 'comfy_mtb')
        await showEmptyGraphAtZoomOne(comfyPage)
      })

      test('Note+ displays its markdown rendered as HTML inside the node', async ({
        comfyPage
      }) => {
        const id = await addPackNode(comfyPage, NOTE_PLUS, [200, 200])
        const heading = comfyPage.page.locator('.note-plus-preview h1')

        await expect(heading).toHaveText('📝 Note+')
        await expect(heading).toBeVisible()
        const node = await nodeScreenRect(comfyPage, id)
        const box = await heading.boundingBox()
        expect(box, 'heading box').not.toBeNull()
        expect(box!.x).toBeGreaterThanOrEqual(node.x)
        expect(box!.y).toBeGreaterThanOrEqual(node.y)
        expect(box!.y + box!.height).toBeLessThanOrEqual(node.y + node.height)
      })

      test('Note+ edit icon opens the editor and the note shows the edited markdown', async ({
        comfyPage
      }) => {
        const id = await addPackNode(comfyPage, NOTE_PLUS, [200, 200])
        const heading = comfyPage.page.locator('.note-plus-preview h1')
        await expect(heading).toHaveText('📝 Note+')
        const [x, y, width, height] = await editIconRect(comfyPage, id)

        const icon = await nodeLocalPoint(comfyPage, id, [
          x + width / 2,
          y + height / 2
        ])
        await comfyPage.page.mouse.click(icon.x, icon.y)
        const editor = comfyPage.page.locator('#noteplus-html-editor')
        await expect(editor, 'Note+ editor dialog').toBeVisible()
        await editor.click()
        await comfyPage.page.keyboard.press('ControlOrMeta+a')
        await comfyPage.page.keyboard.type('# Edited by acceptance')

        await expect(heading).toHaveText('Edited by acceptance')
      })

      test('Note+ draws its edit icon in the title bar', async ({
        comfyPage
      }) => {
        const id = await addPackNode(comfyPage, NOTE_PLUS, [200, 200])
        await comfyPage.page.mouse.move(5, 5)
        const area = await nodeLocalRect(
          comfyPage,
          id,
          await editIconRect(comfyPage, id)
        )

        await expect
          .poll(
            () =>
              countColour(comfyPage, area, EDIT_ICON_STROKE_ON_NOTE_TITLE, 25),
            { message: 'pencil icon strokes in the title bar' }
          )
          .toBeGreaterThan(30)
      })

      test('Help "?" in the title opens the node documentation popup', async ({
        comfyPage
      }) => {
        const id = await addPackNode(comfyPage, STACK_IMAGES, [200, 200])
        const width = await comfyPage.page.evaluate(
          (nodeId) => window.app!.graph.getNodeById(nodeId)!.size[0],
          id
        )
        const help = await nodeLocalPoint(comfyPage, id, [width - 11, -13])

        await comfyPage.page.mouse.click(help.x, help.y)

        const popup = comfyPage.page.locator('.documentation-popup')
        await expect(popup).toBeVisible()
        await expect(popup).toContainText(
          'Stack the input images horizontally or vertically.'
        )
      })
    }
  )
}
