import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'

import type { ListAssetsResponse } from '@comfyorg/ingest-types'

import { STABLE_OUTPUT } from '@e2e/fixtures/data/assetFixtures'
import { WEB_SESSION_COOKIE } from '@e2e/fixtures/data/webSession'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'
import { webSessionTest } from '@e2e/fixtures/webSessionFixture'

interface AssetRedirect {
  bytes: Buffer
  requestHeaders: Record<string, string>[]
  storageCookies: (string | undefined)[]
}

export const assetDownloadRedirectTest = webSessionTest.extend<{
  assetRedirect: AssetRedirect
}>({
  assetRedirect: [
    async ({ page, networkPolicy, initialLocalStorage }, use) => {
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
      await new Promise<void>((resolve) =>
        storage.listen(0, '127.0.0.1', resolve)
      )
      const address = storage.address()
      if (!address || typeof address === 'string')
        throw new Error('TCP address required')
      const storageOrigin = `http://127.0.0.1:${address.port}`
      networkPolicy.origins.add(storageOrigin)

      try {
        await page.context().addCookies([
          {
            name: 'storage_session',
            value: 'storage-only',
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
        await use({ bytes, requestHeaders, storageCookies })
      } finally {
        networkPolicy.origins.delete(storageOrigin)
        await new Promise<void>((resolve) => storage.close(() => resolve()))
      }
    },
    { auto: true }
  ]
})
