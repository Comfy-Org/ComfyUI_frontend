import { expect, mergeTests } from '@playwright/test'

import { canvasMenuFixture } from '@e2e/fixtures/canvasMenuFixture'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import {
  readBackgroundColor,
  resolveColorVariable
} from '@e2e/fixtures/utils/cssColors'
import { readPanelStyle } from '@e2e/fixtures/utils/panelStyle'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture, canvasMenuFixture)

test.describe('Floating toolbars', { tag: ['@ui', '@canvas'] }, () => {
  test.use({ initialSettings: { 'Comfy.Graph.CanvasMenu': true } })

  test('graph toggle, actionbar card and canvas menu share one panel style', async ({
    comfyPage,
    canvasMenu
  }) => {
    const toggle = comfyPage.appMode.workflowActions.viewModeToggle
    const card = comfyPage.actionbar.card
    await expect(toggle).toBeVisible()
    await expect(card).toBeVisible()
    await expect(canvasMenu.root).toBeVisible()

    const [toggleStyle, cardStyle, canvasMenuStyle] = await Promise.all([
      readPanelStyle(toggle),
      readPanelStyle(card),
      readPanelStyle(canvasMenu.root)
    ])
    expect(toggleStyle.borderStyle).toBe('none')
    expect(cardStyle).toEqual(toggleStyle)
    expect(canvasMenuStyle).toEqual(toggleStyle)
  })

  test('graph toggle and actionbar card start at the same top edge', async ({
    comfyPage
  }) => {
    const toggle = comfyPage.appMode.workflowActions.viewModeToggle
    const card = comfyPage.actionbar.card

    await expect
      .poll(async () => {
        const [toggleBox, cardBox] = await Promise.all([
          toggle.boundingBox(),
          card.boundingBox()
        ])
        if (!toggleBox || !cardBox) return null
        return {
          topOffset: cardBox.y - toggleBox.y,
          heightDifference: cardBox.height - toggleBox.height
        }
      })
      .toEqual({ topOffset: 0, heightDifference: 0 })
  })

  test('cancel run button is secondary while idle and destructive while running', async ({
    comfyPage,
    getWebSocket
  }) => {
    const cancel = comfyPage.actionbar.cancelButton
    const [secondary, destructive] = await Promise.all([
      resolveColorVariable(comfyPage.page, '--color-secondary-background'),
      resolveColorVariable(comfyPage.page, '--color-destructive-background')
    ])
    expect(destructive).not.toBe(secondary)

    await expect(cancel).toBeDisabled()
    await expect.poll(() => readBackgroundColor(cancel)).toBe(secondary)

    const exec = new ExecutionHelper(comfyPage, await getWebSocket())
    const jobId = await exec.run()
    exec.executionStart(jobId)

    await expect(cancel).toBeEnabled()
    await expect.poll(() => readBackgroundColor(cancel)).toBe(destructive)
  })
})
