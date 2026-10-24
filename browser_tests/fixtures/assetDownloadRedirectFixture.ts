import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'

import type { TestInfo } from '@playwright/test'

import type { ListAssetsResponse } from '@comfyorg/ingest-types'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { STABLE_OUTPUT } from '@e2e/fixtures/data/assetFixtures'
import { WEB_SESSION_COOKIE } from '@e2e/fixtures/data/webSession'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'
import {
  MOCK_WORKSPACE_TOKEN,
  mockWorkspaceTokenMint,
  workspace
} from '@e2e/fixtures/utils/workspaceMocks'
import { webSessionTest } from '@e2e/fixtures/webSessionFixture'

const STORAGE_COOKIE = 'storage_session=storage-only'
const APP_HOST = new URL(
  process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
).hostname

interface AssetRedirect {
  bytes: Buffer
  requestHeaders: Record<string, string>[]
  storageCookies: (string | undefined)[]
  assertStorageRejectsCredentials: () => Promise<void>
}

export const assetDownloadRedirectTest = webSessionTest.extend<{
  rail: 'cookie' | 'token'
  assetRedirect: AssetRedirect
}>({
  rail: ['cookie', { option: true }],
  assetRedirect: [
    async ({ page, networkPolicy, initialLocalStorage, rail }, use) => {
      const bytes = await readFile(assetPath('test_upload_image.png'))
      const requestHeaders: Record<string, string>[] = []
      const storageCookies: (string | undefined)[] = []
      const storage = createServer((request, response) => {
        response.setHeader(
          'Access-Control-Allow-Origin',
          request.headers.origin ?? '*'
        )
        response.setHeader('Access-Control-Allow-Methods', 'GET')
        response.setHeader(
          'Access-Control-Allow-Headers',
          request.headers['access-control-request-headers'] ?? '*'
        )
        if (request.method === 'OPTIONS') {
          response.writeHead(204).end()
          return
        }
        storageCookies.push(request.headers.cookie)
        response.writeHead(200, { 'Content-Type': 'image/png' }).end(bytes)
      })
      await new Promise<void>((resolve) => storage.listen(0, APP_HOST, resolve))
      const address = storage.address()
      if (!address || typeof address === 'string')
        throw new Error('TCP address required')
      const storageOrigin = `http://${APP_HOST}:${address.port}`
      networkPolicy.origins.add(storageOrigin)

      const assertStorageRejectsCredentials = async () => {
        const anonymousStatus = await page.evaluate(
          async (origin) =>
            (await fetch(`${origin}/signed.png`, { credentials: 'omit' }))
              .status,
          storageOrigin
        )
        const credentialed = await page.evaluate(async (origin) => {
          try {
            await fetch(`${origin}/signed.png`, { credentials: 'include' })
            return 'resolved'
          } catch {
            return 'rejected'
          }
        }, storageOrigin)
        const [omitCookie, includeCookie] = storageCookies.splice(0)
        if (
          anonymousStatus !== 200 ||
          credentialed !== 'rejected' ||
          omitCookie !== undefined ||
          !includeCookie?.includes(STORAGE_COOKIE)
        ) {
          throw new Error(
            `storage stub must see the storage cookie only on credentialed fetches and reject them; the redirect regression depends on it (omit: ${anonymousStatus} cookie ${omitCookie}, include: ${credentialed} cookie ${includeCookie})`
          )
        }
      }

      try {
        if (rail === 'token') {
          await page.context().clearCookies({ name: WEB_SESSION_COOKIE.name })
          await mockWorkspaceTokenMint(page, workspace('personal', 'owner'))
        }
        const [cookieName, cookieValue] = STORAGE_COOKIE.split('=')
        await page.context().addCookies([
          {
            name: cookieName,
            value: cookieValue,
            url: storageOrigin
          }
        ])
        await mockViewFiles(page, { [STABLE_OUTPUT.name]: {} })
        await page.route(/\/api\/assets(?:\?.*)?$/, (route) => {
          const params = new URL(route.request().url()).searchParams
          const assets = params.get('tags_any')?.includes('output')
            ? [
                {
                  ...STABLE_OUTPUT,
                  preview_url: `/api/view?filename=${STABLE_OUTPUT.name}&type=output`
                }
              ]
            : []
          return route.fulfill(
            jsonRoute({
              assets,
              total: assets.length,
              has_more: false
            } satisfies ListAssetsResponse)
          )
        })
        await page.route(
          `**/api/assets/${STABLE_OUTPUT.id}/content**`,
          async (route) => {
            const headers = await route.request().allHeaders()
            const cookie = new Headers(headers).get('cookie')
            requestHeaders.push(headers)
            if (rail === 'token') {
              await route.fulfill(
                new Headers(headers).get('authorization') ===
                  `Bearer ${MOCK_WORKSPACE_TOKEN}`
                  ? {
                      status: 302,
                      headers: { Location: `${storageOrigin}/signed.png` }
                    }
                  : { status: 401 }
              )
              return
            }
            const workspace =
              initialLocalStorage['Comfy.Workspace.LastWorkspaceId'] ??
              'ws-personal'
            if (
              !cookie?.includes(
                `${WEB_SESSION_COOKIE.name}=${WEB_SESSION_COOKIE.value}`
              )
            ) {
              await route.fulfill({ status: 401 })
              return
            }
            if (headers['x-comfy-workspace-id'] !== workspace) {
              await route.fulfill({ status: 404 })
              return
            }
            await route.fulfill({
              status: 302,
              headers: { Location: `${storageOrigin}/signed.png` }
            })
          }
        )
        await use({
          bytes,
          requestHeaders,
          storageCookies,
          assertStorageRejectsCredentials
        })
      } finally {
        networkPolicy.origins.delete(storageOrigin)
        await new Promise<void>((resolve) => storage.close(() => resolve()))
      }
    },
    { auto: true }
  ]
})

export async function downloadStableOutput(
  comfyPage: ComfyPage,
  testInfo: TestInfo
) {
  const tab = comfyPage.menu.assetsTab
  await tab.open()
  await tab.waitForAssets(1)
  await tab.rightClickAsset('ComfyUI_00001_')
  const downloadPromise = comfyPage.page.waitForEvent('download')
  await comfyPage.contextMenu.clickMenuItemExact('Download')
  const download = await downloadPromise
  const file = testInfo.outputPath(STABLE_OUTPUT.name)
  await download.saveAs(file)
  return {
    suggestedFilename: download.suggestedFilename(),
    bytes: await readFile(file)
  }
}
