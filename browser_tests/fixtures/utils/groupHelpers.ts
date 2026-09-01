import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

const GROUP_TITLE_CLICK_OFFSET_X = 50
const GROUP_TITLE_CLICK_OFFSET_Y = 15

/**
 * Returns the client-space position of a group's title bar (for clicking).
 */
export async function getGroupTitlePosition(
  comfyPage: ComfyPage,
  title: string
): Promise<{ x: number; y: number }> {
  const pos = await comfyPage.page.evaluate(
    ({ title, offsetX, offsetY }) => {
      const app = window.app!
      const group = app.graph.groups.find(
        (g: { title: string }) => g.title === title
      )
      if (!group) return null
      const clientPos = app.canvasPosToClientPos([
        group.pos[0] + offsetX,
        group.pos[1] + offsetY
      ])
      return { x: clientPos[0], y: clientPos[1] }
    },
    {
      title,
      offsetX: GROUP_TITLE_CLICK_OFFSET_X,
      offsetY: GROUP_TITLE_CLICK_OFFSET_Y
    }
  )
  if (!pos) throw new Error(`Group "${title}" not found`)
  return pos
}
