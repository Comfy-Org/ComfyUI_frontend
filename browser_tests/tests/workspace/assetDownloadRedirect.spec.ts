import { expect } from '@playwright/test'

import {
  assetDownloadRedirectTest as test,
  downloadStableOutput
} from '@e2e/fixtures/assetDownloadRedirectFixture'
import { STABLE_OUTPUT } from '@e2e/fixtures/data/assetFixtures'
import { WEB_SESSION_COOKIE } from '@e2e/fixtures/data/webSession'
import { MOCK_WORKSPACE_TOKEN } from '@e2e/fixtures/utils/workspaceMocks'

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
      await assetRedirect.assertStorageRejectsCredentials()

      const download = await downloadStableOutput(comfyPage, testInfo)
      expect(download.suggestedFilename).toBe(STABLE_OUTPUT.name)
      expect(download.bytes).toEqual(assetRedirect.bytes)
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

    const download = await downloadStableOutput(comfyPage, testInfo)
    expect(download.suggestedFilename).toBe(STABLE_OUTPUT.name)
    expect(download.bytes).toEqual(assetRedirect.bytes)
    expect(assetRedirect.storageCookies).toEqual([undefined])
    expect(assetRedirect.requestHeaders).toHaveLength(1)
    const [firstHop] = assetRedirect.requestHeaders
    expect(firstHop.authorization).toBe(`Bearer ${MOCK_WORKSPACE_TOKEN}`)
    expect(new Headers(firstHop).get('cookie') ?? '').not.toContain(
      `${WEB_SESSION_COOKIE.name}=`
    )
  })
})
