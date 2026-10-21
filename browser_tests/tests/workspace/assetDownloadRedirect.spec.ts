import { readFile } from 'node:fs/promises'

import type { TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { assetDownloadRedirectTest as test } from '@e2e/fixtures/assetDownloadRedirectFixture'
import { STABLE_OUTPUT } from '@e2e/fixtures/data/assetFixtures'
import { WEB_SESSION_COOKIE } from '@e2e/fixtures/data/webSession'

// SSO sign-in creates the web session exactly as POST /api/auth/session does,
// and fetchOnWebSession handles SSO_REQUIRED itself, so the cookie rows cover
// SSO sessions. The 302 is injected by page.route, which only the
// Playwright-bundled Chromium follows into the storage server; system Chrome
// aborts intercepted redirects.

test.use({
  firebaseLogin: false,
  serverFeatures: { assets: true, unified_cloud_auth: true }
})

async function downloadStableOutput(comfyPage: ComfyPage, testInfo: TestInfo) {
  const tab = comfyPage.menu.assetsTab
  await tab.open()
  await tab.waitForAssets(1)
  await tab.rightClickAsset('ComfyUI_00001_')
  const downloadPromise = comfyPage.page.waitForEvent('download')
  await comfyPage.contextMenu.clickMenuItemExact('Download')
  const download = await downloadPromise
  const file = testInfo.outputPath(STABLE_OUTPUT.name)
  await download.saveAs(file)
  expect(download.suggestedFilename()).toBe(STABLE_OUTPUT.name)
  return readFile(file)
}

for (const workspace of ['ws-personal', 'ws-team']) {
  test.describe(`Asset download in ${workspace}`, { tag: '@cloud' }, () => {
    test.use({
      initialLocalStorage: { 'Comfy.Workspace.LastWorkspaceId': workspace }
    })

    test('downloads through a storage redirect without credentialed CORS', async ({
      comfyPage,
      assetRedirect
    }, testInfo) => {
      await assetRedirect.assertStorageRejectsCredentials()

      expect(await downloadStableOutput(comfyPage, testInfo)).toEqual(
        assetRedirect.bytes
      )
      expect(assetRedirect.storageCookies).toEqual([undefined])
      expect(assetRedirect.requestHeaders).toEqual([
        expect.objectContaining({
          cookie: expect.stringContaining(
            `${WEB_SESSION_COOKIE.name}=${WEB_SESSION_COOKIE.value}`
          ),
          'x-comfy-workspace-id': workspace
        })
      ])
    })
  })
}

// fetchApi sets no `credentials` on the token rail, so the credentialed-CORS
// failure cannot happen here by construction; this row guards the mirror-image
// regression of the token rail picking up the session cookie path.
test.describe('Asset download on the token rail', { tag: '@cloud' }, () => {
  test.use({
    rail: 'token',
    firebaseLogin: true,
    serverFeatures: {
      assets: true,
      unified_cloud_auth: true,
      unified_web_session: false
    }
  })

  test('downloads through a storage redirect on a bearer token', async ({
    comfyPage,
    assetRedirect
  }, testInfo) => {
    await assetRedirect.assertStorageRejectsCredentials()

    expect(await downloadStableOutput(comfyPage, testInfo)).toEqual(
      assetRedirect.bytes
    )
    expect(assetRedirect.storageCookies).toEqual([undefined])
    expect(assetRedirect.requestHeaders).toHaveLength(1)
    const [firstHop] = assetRedirect.requestHeaders
    expect(firstHop.authorization).toMatch(/^Bearer /)
    expect(new Headers(firstHop).get('cookie') ?? '').not.toContain(
      `${WEB_SESSION_COOKIE.name}=`
    )
  })
})
