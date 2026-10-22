import { readFile } from 'node:fs/promises'

import { expect } from '@playwright/test'

import { assetDownloadRedirectTest as test } from '@e2e/fixtures/assetDownloadRedirectFixture'
import { STABLE_OUTPUT } from '@e2e/fixtures/data/assetFixtures'
import { WEB_SESSION_COOKIE } from '@e2e/fixtures/data/webSession'

test.use({
  firebaseLogin: false,
  serverFeatures: { assets: true, unified_cloud_auth: true }
})

for (const workspace of ['ws-personal', 'ws-team']) {
  test.describe(`Asset download in ${workspace}`, { tag: '@cloud' }, () => {
    test.use({
      initialLocalStorage: { 'Comfy.Workspace.LastWorkspaceId': workspace }
    })

    test('downloads through a storage redirect without credentialed CORS', async ({
      comfyPage,
      assetRedirect
    }, testInfo) => {
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
      expect(await readFile(file)).toEqual(assetRedirect.bytes)
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
