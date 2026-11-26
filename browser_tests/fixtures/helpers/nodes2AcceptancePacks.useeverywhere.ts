import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { graphToClient } from '@e2e/fixtures/helpers/nodes2AcceptancePacks'

export const NEW_LABEL = 'positive'

export async function renameFirstInput(
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
