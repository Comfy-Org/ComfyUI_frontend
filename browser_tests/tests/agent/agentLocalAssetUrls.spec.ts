import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'
import { assetPath } from '@e2e/fixtures/utils/paths'
import {
  THINKING_EVENT,
  THINKING_TEXT,
  agentMessageDeltaEvent,
  agentTest
} from '@e2e/tests/agent/agentPanelMocks'

/**
 * The local ("standalone") agent writes image previews into chat as absolute
 * URLs of the ComfyUI it drives — `http://127.0.0.1:8188/view?filename=...`.
 * Opened from any machine but the one running ComfyUI, that loopback host is
 * the READER's own computer and every chat image is broken, so the standalone
 * panel re-homes such a reference onto its own origin.
 *
 * That re-homing is gated on `VITE_AGENT_STANDALONE`, which is baked at build
 * time and unset in every CI dist (the same reason `playwright.config.ts`
 * keeps the `agent-harness` project out of CI), so the standalone half of the
 * behaviour is asserted in `MarkdownStream.test.ts` and `replyAssets.test.ts`
 * instead. What CI can and must hold is the other half of the contract: the
 * cloud build this suite runs against must keep rendering agent images exactly
 * as authored — a loopback URL is left alone rather than silently repointed at
 * the cloud origin, and an ordinary `/view` reference still renders and loads.
 */
const test = mergeTests(agentTest, webSocketFixture)

const LOOPBACK_IMAGE =
  'http://127.0.0.1:8188/view?filename=ComfyUI_00005_.png&subfolder=&type=output'
const PANEL_IMAGE = '/api/view?filename=ComfyUI_00006_.png&type=output'

test.describe('Agent reply image URLs', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  test('renders agent reply images with the URL the agent authored', async ({
    agentPanel,
    getWebSocket,
    page
  }) => {
    // Both hosts answer with a real PNG, so a rendered <img> that decodes
    // proves the panel asked for a reachable URL rather than a dead one.
    await page.route(
      (url) => url.pathname.endsWith('/view'),
      (route) => route.fulfill({ path: assetPath('image64x64.webp') })
    )

    await agentPanel.open()
    await agentPanel.selectWorkflow()
    await agentPanel.sendPrompt('Draw me a duck')

    const ws = await getWebSocket()
    ws.send(JSON.stringify(THINKING_EVENT))
    await expect(agentPanel.root.getByText(THINKING_TEXT)).toBeVisible()

    ws.send(
      JSON.stringify(
        agentMessageDeltaEvent(
          `Here it is ![a duck](${LOOPBACK_IMAGE}) — enjoy.\n\n` +
            `![a second duck](${PANEL_IMAGE})\n`
        )
      )
    )

    const loopback = agentPanel.root.getByRole('img', { name: 'a duck' })
    const panelHosted = agentPanel.root.getByRole('img', {
      name: 'a second duck'
    })
    await expect(loopback).toBeVisible()
    await expect(panelHosted).toBeVisible()

    await test.step('the cloud build leaves a loopback URL untouched', async () => {
      // The standalone-only re-homing must not leak into the cloud product:
      // there the reader may genuinely be the machine the URL names.
      await expect(loopback).toHaveAttribute('src', LOOPBACK_IMAGE)
    })

    await test.step('a panel-hosted reference resolves same-origin and loads', async () => {
      const src = await panelHosted.getAttribute('src')
      expect(new URL(src!, page.url()).origin).toBe(new URL(page.url()).origin)
      await expect
        .poll(() =>
          panelHosted.evaluate(
            (img) => (img as HTMLImageElement).naturalWidth > 0
          )
        )
        .toBe(true)
    })
  })
})
