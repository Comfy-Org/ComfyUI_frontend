import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { getGroupTitlePosition } from '@e2e/fixtures/utils/groupHelpers'

const GROUP_TITLE = 'Group'

function getTitleTextMaxLuminance(comfyPage: ComfyPage, title: string) {
  return comfyPage.page.evaluate((title) => {
    const app = window.app!
    const group = app.graph.groups.find(
      (g: { title: string }) => g.title === title
    )
    if (!group) throw new Error(`Group "${title}" not found`)

    const canvasEl = app.canvas.canvas
    const titleHeight = window.LiteGraph!.NODE_TITLE_HEIGHT
    const [x1, y1] = app.canvasPosToClientPos([group.pos[0], group.pos[1]])
    const [x2, y2] = app.canvasPosToClientPos([
      group.pos[0] + group.size[0],
      group.pos[1] + titleHeight
    ])

    const rect = canvasEl.getBoundingClientRect()
    const scaleX = canvasEl.width / rect.width
    const scaleY = canvasEl.height / rect.height
    const left = Math.max(
      0,
      Math.round((Math.min(x1, x2) - rect.left) * scaleX)
    )
    const top = Math.max(0, Math.round((Math.min(y1, y2) - rect.top) * scaleY))
    const right = Math.min(
      canvasEl.width,
      Math.round((Math.max(x1, x2) - rect.left) * scaleX)
    )
    const bottom = Math.min(
      canvasEl.height,
      Math.round((Math.max(y1, y2) - rect.top) * scaleY)
    )

    const ctx = canvasEl.getContext('2d')!
    const { data } = ctx.getImageData(left, top, right - left, bottom - top)
    let maxLuminance = 0
    for (let i = 0; i < data.length; i += 4) {
      const luminance =
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      if (luminance > maxLuminance) maxLuminance = luminance
    }
    return maxLuminance
  }, title)
}

test.describe('Group Title Contrast', { tag: ['@canvas'] }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('renders readable title text when a group color is set to black', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('groups/single_group_only')

    const titlePos = await getGroupTitlePosition(comfyPage, GROUP_TITLE)
    await comfyPage.canvas.click({ position: titlePos, button: 'right' })

    const editGroupEntry = comfyPage.page
      .locator('.litemenu-entry')
      .filter({ hasText: 'Edit Group' })
    await expect(editGroupEntry).toBeVisible()
    await editGroupEntry.click()

    const colorEntry = comfyPage.page
      .locator('.litemenu-entry')
      .filter({ hasText: /^Color$/ })
    await expect(colorEntry).toBeVisible()
    await colorEntry.click()

    const blackEntry = comfyPage.page
      .locator('.litemenu-entry')
      .filter({ hasText: /^black$/ })
    await expect(blackEntry).toBeVisible()
    await blackEntry.click()
    await expect(blackEntry).toBeHidden()

    await expect
      .poll(() => getTitleTextMaxLuminance(comfyPage, GROUP_TITLE))
      .toBeGreaterThan(200)
  })
})
