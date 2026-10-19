import { expect, mergeTests } from '@playwright/test'
import { escapeRegExp } from 'es-toolkit'

import { assetPath } from '@e2e/fixtures/utils/paths'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'
import { webSocketFixture } from '@e2e/fixtures/ws'
import {
  THINKING_EVENT,
  THINKING_TEXT,
  agentMessageDeltaEvent,
  agentTest
} from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

const LOOPBACK_IMAGE =
  'http://127.0.0.1:8188/view?filename=ComfyUI_00005_.png&subfolder=&type=output'
const REMOTE_IMAGE = 'http://gpu-box.lan:8188/view?filename=ComfyUI_00007_.png'

test.describe('Agent reply image URLs', { tag: ['@cloud', '@ui'] }, () => {
  test.use({ connectWebSocketToServer: false })

  test('re-homes a loopback reply image onto the page API route', async ({
    agentPanel,
    getAgentSocket,
    page,
    postedMessages
  }) => {
    const pageOrigin = new URL(page.url()).origin
    const duck = { path: assetPath('image64x64.webp') }
    await mockViewFiles(page, {
      'ComfyUI_00005_.png': duck,
      'ComfyUI_00006_.png': duck
    })
    await page.route('http://gpu-box.lan:8188/view**', (route) =>
      route.fulfill(duck)
    )

    await agentPanel.open()
    await agentPanel.selectWorkflow()

    const ws = await getAgentSocket()
    await agentPanel.sendMessage('Draw me a duck')
    await expect.poll(() => postedMessages).toHaveLength(1)

    ws.send(JSON.stringify(THINKING_EVENT))
    await expect(agentPanel.root.getByText(THINKING_TEXT)).toBeVisible()

    ws.send(
      JSON.stringify(
        agentMessageDeltaEvent(
          `Here it is ![a duck](${LOOPBACK_IMAGE}) and ![a remote duck](${REMOTE_IMAGE}) — enjoy.\n\n` +
            `![a second duck](${LOOPBACK_IMAGE.replace('00005', '00006')})\n`
        )
      )
    )

    const inProse = agentPanel.root.getByRole('img', { name: 'a duck' })
    const asAsset = agentPanel.root.getByRole('img', { name: 'a second duck' })
    const remote = agentPanel.root.getByRole('img', { name: 'a remote duck' })
    await expect(inProse).toBeVisible()
    await expect(asAsset).toBeVisible()
    await expect(remote).toBeVisible()

    await test.step("both rendering paths point at the page's api route", async () => {
      const onPageApi = (filename: string) =>
        new RegExp(
          `^${escapeRegExp(pageOrigin)}/api/view\\?filename=${filename}\\.png&`
        )
      await expect(inProse).toHaveAttribute('src', onPageApi('ComfyUI_00005_'))
      await expect(asAsset).toHaveAttribute('src', onPageApi('ComfyUI_00006_'))
    })

    await test.step('a remote ComfyUI host is left as authored', async () => {
      await expect(remote).toHaveAttribute('src', REMOTE_IMAGE)
    })
  })
})
