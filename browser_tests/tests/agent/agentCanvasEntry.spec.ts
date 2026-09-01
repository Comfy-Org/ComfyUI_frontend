import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { MESSAGE_DONE_EVENT, agentTest } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

test.describe('Agent canvas entry', { tag: ['@cloud', '@ui'] }, () => {
  test.use({ connectWebSocketToServer: false })
  test.use({ viewport: { width: 1024, height: 768 } })

  test('sends with Enter and keeps the learning flow on the canvas', async ({
    comfyPage,
    postedMessages,
    getWebSocket
  }) => {
    const page = comfyPage.page
    const composer = page.getByRole('textbox', {
      name: enMessages.agent.compactComposer.label
    })
    const prompt = 'Build a product photo workflow with a saved image output.'

    await expect(composer).toBeVisible()
    const composerBox = await page
      .getByTestId('agent-compact-composer')
      .boundingBox()
    const toolbarBox = await page
      .getByRole('toolbar', {
        name: enMessages.graphCanvasMenu.canvasToolbar
      })
      .boundingBox()
    expect(composerBox).not.toBeNull()
    expect(toolbarBox).not.toBeNull()
    if (!composerBox || !toolbarBox)
      throw new Error('Expected compact composer and canvas toolbar bounds')
    expect(
      composerBox.x + composerBox.width <= toolbarBox.x ||
        toolbarBox.x + toolbarBox.width <= composerBox.x ||
        composerBox.y + composerBox.height <= toolbarBox.y ||
        toolbarBox.y + toolbarBox.height <= composerBox.y
    ).toBe(true)
    await composer.fill(prompt)
    await composer.press('Enter')

    await expect.poll(() => postedMessages.length).toBe(1)
    expect(postedMessages[0]).toContain(prompt)
    await expect(page.locator('#agent-panel-root')).toBeHidden()
    await expect(page.getByTestId('docked-agent-panel')).toBeHidden()
    await expect(composer).toBeVisible()
    await expect(composer).toBeDisabled()
    await expect(
      page.getByText(enMessages.agent.compactComposer.building)
    ).toBeVisible()

    const ws = await getWebSocket()
    ws.send(JSON.stringify(MESSAGE_DONE_EVENT))

    await expect(composer).toBeEnabled()
  })
})
