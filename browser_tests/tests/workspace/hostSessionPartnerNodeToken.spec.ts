import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import {
  HOST_OAUTH_TOKEN,
  HOST_WORKSPACE_ID,
  PARTNER_NODE_TOKEN,
  hostSessionPartnerNodeTest as test
} from '@e2e/fixtures/hostSessionPartnerNodeFixture'

async function queuedAuthToken(page: Page): Promise<string | undefined> {
  const promptRequest = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname.endsWith('/api/prompt')
  )
  await page.evaluate(() => window.app!.queuePrompt(0))
  const body = (await promptRequest).postDataJSON() as {
    extra_data?: { auth_token_comfy_org?: string }
  }
  return body.extra_data?.auth_token_comfy_org
}

test.describe('Host session partner-node token', { tag: '@auth' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.toast.closeToasts()
  })

  test('queues with a partner-node token minted from the host OAuth token', async ({
    comfyPage,
    hostPartnerNode
  }) => {
    expect(await queuedAuthToken(comfyPage.page)).toBe(PARTNER_NODE_TOKEN)

    expect(hostPartnerNode.mints).toHaveLength(1)
    const [mint] = hostPartnerNode.mints
    expect(await mint.headerValue('authorization')).toBe(
      `Bearer ${HOST_OAUTH_TOKEN}`
    )
    expect(mint.postDataJSON()).toEqual({
      workspace_id: HOST_WORKSPACE_ID,
      resource: 'partner-node'
    })
  })

  test('queues with the host token when the mint fails', async ({
    comfyPage,
    hostPartnerNode
  }) => {
    hostPartnerNode.failMintsWith(503)

    expect(await queuedAuthToken(comfyPage.page)).toBe(HOST_OAUTH_TOKEN)
    expect(hostPartnerNode.mints).toHaveLength(1)
  })

  test('revokes the partner-node session on host sign-out', async ({
    comfyPage,
    hostPartnerNode
  }) => {
    expect(await queuedAuthToken(comfyPage.page)).toBe(PARTNER_NODE_TOKEN)

    await comfyPage.page.evaluate(() =>
      window.__pushHostAuthState!({ status: 'signed_out' })
    )

    await expect.poll(() => hostPartnerNode.revokes.length).toBe(1)
    expect(await hostPartnerNode.revokes[0].headerValue('authorization')).toBe(
      `Bearer ${PARTNER_NODE_TOKEN}`
    )
  })
})
