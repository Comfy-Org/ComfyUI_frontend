import type { Page } from '@playwright/test'

import type { AssetDownloadWsMessage } from '@/platform/remote/comfyui/execution/types'

export async function dispatchAssetDownload(
  page: Page,
  message: AssetDownloadWsMessage
) {
  await page.evaluate((msg) => {
    window.app!.api.dispatchCustomEvent('asset_download', msg)
  }, message)
}
