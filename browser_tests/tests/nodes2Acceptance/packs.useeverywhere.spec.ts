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
  expectPackLoaded,
  keepMixlabOffNodeDrawHooks,
  graphToClient,
  nodeValue,
  showEmptyGraphAtZoomOne
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'

const NEW_LABEL = 'positive'

async function renameFirstInput(
  comfyPage: ComfyPage,
  nodeId: NodeId,
  currentLabel: string
) {
  const { page } = comfyPage
  if (comfyPage.isVueNodes) {
    const label = comfyPage.vueNodes
      .getNodeLocator(nodeId)
      .getByText(currentLabel, { exact: true })
    await label.dblclick()
    const editor = comfyPage.vueNodes
      .getNodeLocator(nodeId)
      .locator('input[type="text"]')
    await expect(editor, 'slot label editor').toBeVisible()
    await editor.fill(NEW_LABEL)
    await editor.press('Enter')
    return
  }
  const slot = await comfyPage.page
    .evaluate((id) => {
      const position = window.app!.graph.getNodeById(id)!.getInputPos(0)
      return [position[0], position[1]] as const
    }, nodeId)
    .then((point) => graphToClient(comfyPage, point))
  await page.mouse.click(slot.x, slot.y, { button: 'right' })
  await page
    .locator('.litecontextmenu .litemenu-entry', { hasText: 'Rename Slot' })
    .click()
  const prompt = page.locator('.graphdialog input')
  await expect(prompt, 'slot rename prompt').toBeFocused()
  await prompt.fill(NEW_LABEL)
  await prompt.press('Enter')
}

for (const renderer of PACK_RENDERERS) {
  test.describe(
    `cg-use-everywhere on ${renderer.name}`,
    { tag: [...PACK_TAGS, '@node', ...renderer.tags] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await expectPackLoaded(comfyPage, 'cg-use-everywhere')
        await keepMixlabOffNodeDrawHooks(comfyPage)
        await showEmptyGraphAtZoomOne(comfyPage)
      })

      test('an input slot on a Use Everywhere node can be renamed', async ({
        comfyPage
      }) => {
        const id = await addPackNode(
          comfyPage,
          'Anything Everywhere',
          [300, 200],
          [260, 80]
        )

        await renameFirstInput(comfyPage, id, 'anything')

        await expect
          .poll(() => nodeValue(comfyPage, id, ['inputs', '0', 'label']))
          .toBe(NEW_LABEL)
      })

      test('control: an input slot on an ordinary node can be renamed the same way', async ({
        comfyPage
      }) => {
        const id = await addPackNode(
          comfyPage,
          'VAEDecode',
          [300, 200],
          [260, 80]
        )

        await renameFirstInput(comfyPage, id, 'samples')

        await expect
          .poll(() => nodeValue(comfyPage, id, ['inputs', '0', 'label']))
          .toBe(NEW_LABEL)
      })
    }
  )
}
