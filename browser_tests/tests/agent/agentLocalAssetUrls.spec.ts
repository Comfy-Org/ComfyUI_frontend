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
 * The local agent writes image previews into chat as absolute URLs of the
 * ComfyUI it drives — `http://127.0.0.1:8188/view?filename=...`. Opened from
 * any machine but the one running ComfyUI, that loopback host is the READER's
 * own computer and every chat image is broken, so the panel re-homes such a
 * reference onto the page's own origin, which answers the same `/view` routes.
 *
 * A genuinely remote ComfyUI host must survive untouched: there the reader
 * cannot reach the image on their own origin either, and rewriting would take
 * away a link that works.
 */
const test = mergeTests(agentTest, webSocketFixture)

const LOOPBACK_IMAGE =
  'http://127.0.0.1:8188/view?filename=ComfyUI_00005_.png&subfolder=&type=output'
const REMOTE_IMAGE = 'http://gpu-box.lan:8188/view?filename=ComfyUI_00007_.png'

test.describe('Agent reply image URLs', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  test('re-homes a loopback reply image onto the page origin', async ({
    agentPanel,
    getWebSocket,
    page
  }) => {
    // Only the page's own origin answers with a real PNG; a request that still
    // went to the agent's machine would be left undecoded.
    const pageOrigin = new URL(page.url()).origin
    await page.route(
      (url) =>
        url.pathname.endsWith('/view') &&
        (url.origin === pageOrigin || url.hostname === 'gpu-box.lan'),
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
            `![a second duck](${LOOPBACK_IMAGE.replace('00005', '00006')})\n\n` +
            `And one rendered elsewhere ![a remote duck](${REMOTE_IMAGE}).\n`
        )
      )
    )

    const inProse = agentPanel.root.getByRole('img', { name: 'a duck' })
    const asAsset = agentPanel.root.getByRole('img', { name: 'a second duck' })
    const remote = agentPanel.root.getByRole('img', { name: 'a remote duck' })
    await expect(inProse).toBeVisible()
    await expect(asAsset).toBeVisible()
    await expect(remote).toBeVisible()

    await test.step('both rendering paths point at the page origin', async () => {
      // A loopback image inside prose goes through the markdown renderer; a
      // lone one becomes a reply asset preview. Both were broken.
      await expect(inProse).toHaveAttribute(
        'src',
        `${pageOrigin}/view?filename=ComfyUI_00005_.png&subfolder=&type=output`
      )
      await expect(asAsset).toHaveAttribute(
        'src',
        `${pageOrigin}/view?filename=ComfyUI_00006_.png&subfolder=&type=output`
      )
    })

    await test.step('the re-homed images actually load', async () => {
      for (const image of [inProse, asAsset])
        await expect
          .poll(() =>
            image.evaluate((img) => (img as HTMLImageElement).naturalWidth > 0)
          )
          .toBe(true)
    })

    await test.step('a remote ComfyUI host is left as authored', async () => {
      await expect(remote).toHaveAttribute('src', REMOTE_IMAGE)
    })
  })
})
