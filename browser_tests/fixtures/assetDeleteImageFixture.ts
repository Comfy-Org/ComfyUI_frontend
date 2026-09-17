import { expect, mergeTests } from '@playwright/test'

import type { Asset, ListAssetsResponse } from '@comfyorg/ingest-types'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  STABLE_CHECKPOINT,
  STABLE_INPUT_IMAGE
} from '@e2e/fixtures/data/assetFixtures'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'
import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'

export const DROPPED_FILE = 'image64x64.webp'
export const TARGET_ASSET: Asset = {
  ...STABLE_INPUT_IMAGE,
  name: DROPPED_FILE,
  mime_type: 'image/webp'
}
export const TARGET_CARD_TEXT = TARGET_ASSET.name.replace(/\.[^.]+$/, '')
const SEEDED_ASSETS: Asset[] = [STABLE_CHECKPOINT, TARGET_ASSET]

function parseTagParam(value: string | null): string[] {
  return (
    value
      ?.split(',')
      .map((tag) => tag.trim())
      .filter(Boolean) ?? []
  )
}

function filterByTags(assets: Asset[], url: URL): Asset[] {
  const anyTags = parseTagParam(url.searchParams.get('tags_any'))
  const noneTags = parseTagParam(url.searchParams.get('tags_none'))
  return assets.filter((asset) => {
    const tags = asset.tags ?? []
    const matchesAny =
      anyTags.length === 0 || anyTags.some((tag) => tags.includes(tag))
    const matchesNone = noneTags.every((tag) => !tags.includes(tag))
    return matchesAny && matchesNone
  })
}

const imageFixture = base.extend<{
  comfyPage: ComfyPage
  loadImageNode: NodeReference
  assetMock: { readonly deleteCalls: ReadonlyArray<string> }
  deleteStatus: number
}>({
  deleteStatus: [204, { option: true }],
  assetMock: [
    async ({ page, deleteStatus }, use) => {
      const deleteCalls: string[] = []
      await page.route(/\/api\/assets(?:\?.*)?$/, (route) => {
        if (route.request().method() !== 'GET') return route.fallback()
        const assets = filterByTags(
          SEEDED_ASSETS,
          new URL(route.request().url())
        )
        const body: ListAssetsResponse = {
          assets,
          total: assets.length,
          has_more: false
        }
        return route.fulfill({ json: body })
      })
      await page.route(/\/api\/assets\/([^/?#]+)$/, (route) => {
        const method = route.request().method()
        const id =
          new URL(route.request().url()).pathname.split('/').pop() ?? ''
        if (method === 'DELETE') {
          deleteCalls.push(id)
          return route.fulfill(
            deleteStatus === 204
              ? { status: 204, body: '' }
              : { status: deleteStatus, json: { error: 'delete refused' } }
          )
        }
        if (method === 'GET') {
          const asset = SEEDED_ASSETS.find((asset) => asset.id === id)
          return asset
            ? route.fulfill({ json: asset })
            : route.fulfill({ status: 404, json: { error: 'Not found' } })
        }
        return route.fallback()
      })
      await use({ deleteCalls })
    },
    { auto: true }
  ],
  loadImageNode: async ({ comfyPage }, use) => {
    await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
    const node = await comfyPage.nodeOps.getNodeRefById('10')
    const { x, y } = await node.getPosition()
    await comfyPage.dragDrop.dragAndDropFile(DROPPED_FILE, {
      dropPosition: { x, y },
      waitForUpload: true
    })
    const imageWidget = await node.getWidget(0)
    await expect.poll(() => imageWidget.getValue()).toBe(DROPPED_FILE)
    await expect
      .poll(() =>
        comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.graph.getNodeById(nodeId)
          return node?.imgs?.length ?? 0
        }, node.id)
      )
      .toBeGreaterThan(0)

    await comfyPage.page.evaluate(() => {
      const tracker =
        window.app!.extensionManager.workflow.activeWorkflow!.changeTracker
      tracker.reset()
      tracker.updateModified()
    })
    await expect
      .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
      .toBe(false)

    const sidebar = comfyPage.menu.assetsTab
    await sidebar.open({ waitForAssets: false })
    await sidebar.switchToImported()
    await sidebar.waitForAssets(1)
    await use(node)
  }
})

export const assetDeleteImageFixture = mergeTests(
  comfyPageFixture,
  imageFixture
)
