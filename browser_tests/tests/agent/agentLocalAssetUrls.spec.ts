import { expect, mergeTests } from '@playwright/test'

import { assetPath } from '@e2e/fixtures/utils/paths'
import { webSocketFixture } from '@e2e/fixtures/ws'
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
 * reference onto the page's own API, which answers the same media routes.
 *
 * Onto the API route, not the bare origin: that is the part a deployment
 * actually depends on. A reverse-proxied install is served under a subpath
 * that an origin does not carry, a dev server proxies `/api` and not a bare
 * `/view`, and a web session names its workspace in the query. So this spec
 * serves the fixture image from the page's `/api/view` ONLY — an image
 * re-homed onto the origin root requests a URL nothing answers and never
 * decodes, which is what makes the load assertion below discriminating rather
 * than a restatement of the mock.
 *
 * A genuinely remote ComfyUI host must survive untouched: there the reader
 * cannot reach the image on their own origin either, and rewriting would take
 * away a link that works.
 */
const test = mergeTests(agentTest, webSocketFixture)

const LOOPBACK_IMAGE =
  'http://127.0.0.1:8188/view?filename=ComfyUI_00005_.png&subfolder=&type=output'
const REMOTE_IMAGE = 'http://gpu-box.lan:8188/view?filename=ComfyUI_00007_.png'

test.describe('Agent reply image URLs', { tag: ['@cloud', '@ui'] }, () => {
  test.use({ connectWebSocketToServer: false })

  test('re-homes a loopback reply image onto the page origin', async ({
    agentPanel,
    getWebSocket,
    page,
    postedMessages
  }) => {
    // Only the page's own API route answers with a real PNG. A request that
    // still went to the agent's machine, or one re-homed onto the origin root
    // as a bare `/view`, is left undecoded.
    const pageOrigin = new URL(page.url()).origin
    const apiView = new URL(`${pageOrigin}/api/view`)
    await page.route(
      (url) =>
        (url.origin === apiView.origin && url.pathname === apiView.pathname) ||
        (url.hostname === 'gpu-box.lan' && url.pathname.endsWith('/view')),
      (route) => route.fulfill({ path: assetPath('image64x64.webp') })
    )

    await agentPanel.open()
    await agentPanel.selectWorkflow()

    const ws = await getWebSocket()
    await agentPanel.sendMessage('Draw me a duck')
    await expect.poll(() => postedMessages).toHaveLength(1)

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

    await test.step("both rendering paths point at the page's api route", async () => {
      // A loopback image inside prose goes through the markdown renderer; a
      // lone one becomes a reply asset preview. Both were broken. Matched
      // loosely at the tail because a web session appends `workspace_id`; the
      // discriminating part is the origin and the `/api` prefix.
      for (const [image, filename] of [
        [inProse, 'ComfyUI_00005_'],
        [asAsset, 'ComfyUI_00006_']
      ] as const)
        await expect(image).toHaveAttribute(
          'src',
          new RegExp(
            `^${pageOrigin.replaceAll('.', '\\.')}/api/view\\?filename=${filename}\\.png&`
          )
        )
    })

    await test.step('the re-homed images load from that route', async () => {
      // Fulfilled above for `${pageOrigin}/api/view` alone, so decoding here
      // proves the rewrite targeted the API route and not the origin root.
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
