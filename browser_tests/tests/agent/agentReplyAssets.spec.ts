import type { Page, Route } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import type { Asset, ListAssetsResponse } from '@comfyorg/ingest-types'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { transparentPng } from '@e2e/fixtures/utils/viewFileMocks'
import { webSocketFixture } from '@e2e/fixtures/ws'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import {
  MESSAGE_DONE_EVENT,
  agentTest,
  agentMessageDeltaEvent,
  pushAgentEvent
} from '@e2e/tests/agent/agentPanelMocks'

interface ReplyAssetPreviewOptions {
  previewMissesBefore?: Record<string, number>
}

async function mockReplyAssetPreviews(
  page: Page,
  { previewMissesBefore = {} }: ReplyAssetPreviewOptions = {}
): Promise<string[]> {
  const lookedUp: string[] = []
  const lookupCounts = new Map<string, number>()
  await page.route('**/api/assets**', (route: Route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/content')) {
      return route.fulfill({ contentType: 'image/png', body: transparentPng })
    }
    const name =
      url.searchParams.get('hash') ?? url.searchParams.get('name_contains')
    if (!name) {
      const response = {
        assets: [],
        total: 0,
        has_more: false
      } satisfies ListAssetsResponse
      return route.fulfill(jsonRoute(response))
    }
    if (/^mesh-\d+\.glb$/.test(name)) lookedUp.push(name)
    const seen = (lookupCounts.get(name) ?? 0) + 1
    lookupCounts.set(name, seen)
    const asset = {
      id: `asset-${name}`,
      name,
      hash: name,
      preview_id:
        seen <= (previewMissesBefore[name] ?? 0) ? null : `preview-${name}`,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z'
    } satisfies Asset
    const response = {
      assets: [asset],
      total: 1,
      has_more: false
    } satisfies ListAssetsResponse
    return route.fulfill(jsonRoute(response))
  })
  return lookedUp
}

const COLLAPSED_COUNT = 12

const test = mergeTests(agentTest, webSocketFixture)

test.describe('Agent reply assets', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  test('looks up 3D previews only for the reply assets on screen', async ({
    agentPanel,
    page,
    getWebSocket,
    getAgentSocket
  }) => {
    const MODEL_COUNT = 13
    const HIDDEN_MODEL = `mesh-${MODEL_COUNT - 1}.glb`
    const VISIBLE_MODELS = Array.from(
      { length: COLLAPSED_COUNT },
      (_, index) => `mesh-${index}.glb`
    )
    const MODEL_REPLY = Array.from(
      { length: MODEL_COUNT },
      (_, index) => `- ![mesh-${index}](/api/view?filename=mesh-${index}.glb)`
    ).join('\n')

    const lookedUpModels = await mockReplyAssetPreviews(page)

    await test.step('send a reply containing model assets', async () => {
      await agentPanel.open()
      await agentPanel.sendMessage('show me every mesh')
      await agentPanel.expectUserMessages(['show me every mesh'])
      const ws = await getWebSocket()
      ws.send(JSON.stringify({ type: 'feature_flags', data: { assets: true } }))
      const agentSocket = await getAgentSocket()
      pushAgentEvent(agentSocket, agentMessageDeltaEvent(MODEL_REPLY))
      pushAgentEvent(agentSocket, MESSAGE_DONE_EVENT)
    })

    await test.step('render only the collapsed model previews', async () => {
      await expect(agentPanel.replyAssetTiles).toHaveCount(COLLAPSED_COUNT)
      await expect(agentPanel.replyAssetThumbnails).toHaveCount(COLLAPSED_COUNT)
      const uniqueLookups = [...new Set(lookedUpModels)]
      expect(uniqueLookups).toEqual(expect.arrayContaining(VISIBLE_MODELS))
      expect(uniqueLookups).toHaveLength(VISIBLE_MODELS.length)
    })

    await test.step('expand and render the remaining model preview', async () => {
      await agentPanel.root
        .getByRole('button', { name: enMessages.agent.showMore })
        .click()
      await expect(agentPanel.replyAssetTiles).toHaveCount(MODEL_COUNT)
      await expect(agentPanel.replyAssetThumbnails).toHaveCount(MODEL_COUNT)
      await expect.poll(() => new Set(lookedUpModels).size).toBe(MODEL_COUNT)
      expect(lookedUpModels).toContain(HIDDEN_MODEL)
    })
  })

  test('keeps the reply readable when one asset preview cannot be rendered', async ({
    agentPanel,
    page,
    getWebSocket,
    getAgentSocket
  }) => {
    const UNRENDERABLE = 'mesh-0'
    const lookedUpModels = await mockReplyAssetPreviews(page, {
      previewMissesBefore: { [`${UNRENDERABLE}.glb`]: 1 }
    })
    await page.route(
      (url) =>
        url.pathname.endsWith('/api/view') &&
        url.searchParams.get('filename') === `${UNRENDERABLE}.glb`,
      (route) => route.abort()
    )

    const REPLY_TEXT = 'Here are the meshes I generated.'
    const reply = `${REPLY_TEXT}\n\n${Array.from(
      { length: COLLAPSED_COUNT },
      (_, index) => `- ![mesh-${index}](/api/view?filename=mesh-${index}.glb)`
    ).join('\n')}`

    await test.step('send a reply whose first asset cannot be previewed', async () => {
      await agentPanel.open()
      await agentPanel.sendMessage('show me every mesh')
      await agentPanel.expectUserMessages(['show me every mesh'])
      const ws = await getWebSocket()
      ws.send(JSON.stringify({ type: 'feature_flags', data: { assets: true } }))
      const agentSocket = await getAgentSocket()
      pushAgentEvent(agentSocket, agentMessageDeltaEvent(reply))
      pushAgentEvent(agentSocket, MESSAGE_DONE_EVENT)
    })

    await test.step('the reply and every tile still render', async () => {
      await expect(agentPanel.root.getByText(REPLY_TEXT)).toBeVisible()
      await expect(agentPanel.replyAssetTiles).toHaveCount(COLLAPSED_COUNT)
      await expect(
        agentPanel.root.getByRole('button', { name: UNRENDERABLE, exact: true })
      ).toBeVisible()
    })

    await test.step('the unrenderable tile recovers instead of staying blank', async () => {
      await expect(
        agentPanel.root.getByRole('img', { name: UNRENDERABLE })
      ).toBeVisible()
      await expect(agentPanel.replyAssetThumbnails).toHaveCount(COLLAPSED_COUNT)
      expect(
        lookedUpModels.filter((name) => name === `${UNRENDERABLE}.glb`).length
      ).toBeGreaterThan(1)
    })
  })
})
