import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { MIME_ASSET_INFO } from '@/platform/assets/schemas/mediaAssetSchema'
import type {
  MediaKind,
  parseAssetInfo
} from '@/platform/assets/schemas/mediaAssetSchema'

type DraggedAssetInfo = NonNullable<ReturnType<typeof parseAssetInfo>>

export interface ExpectedAssetPreview {
  filename: string
  ref?: string
  kind: Extract<MediaKind, 'image' | 'video'>
  width?: number
  height?: number
}

export async function dropAssets(
  page: Page,
  target: Locator,
  assets: ExpectedAssetPreview[],
  type: DraggedAssetInfo['type'] = 'output'
) {
  for (const { filename, ref = filename, kind } of assets) {
    const payload: DraggedAssetInfo = {
      filename,
      subfolder: '',
      type,
      display_name: filename,
      attachment_ref: ref,
      media_kind: kind
    }
    const dataTransfer = await page.evaluateHandle(
      ({ mime, payload }) => {
        const transfer = new DataTransfer()
        transfer.setData(mime, JSON.stringify(payload))
        return transfer
      },
      { mime: MIME_ASSET_INFO, payload }
    )
    await target.dispatchEvent('drop', { dataTransfer })
    await dataTransfer.dispose()
  }
}

export async function expectAssets(
  panel: Locator,
  assets: ExpectedAssetPreview[],
  timeout = 10_000
) {
  const deadline = Date.now() + timeout
  const remaining = () => Math.max(1, deadline - Date.now())
  const userMessage = panel
    .getByTestId('user-message-bubble')
    .last()
    .locator('..')
  const previews = userMessage
    .getByTestId('reply-asset-group')
    .locator('img, video')
  await expect(previews).toHaveCount(assets.length, { timeout: remaining() })
  for (const [index, asset] of assets.entries()) {
    const preview = previews.nth(index)
    await expect(preview).toBeVisible({ timeout: remaining() })
    await expect(preview.locator('..')).toHaveAccessibleName(asset.filename, {
      timeout: remaining()
    })
    await expect
      .poll(
        () =>
          preview.evaluate((element) =>
            element instanceof HTMLImageElement
              ? element.naturalWidth > 0 && element.naturalHeight > 0
              : element instanceof HTMLVideoElement
                ? element.videoWidth > 0 && element.videoHeight > 0
                : false
          ),
        { timeout: remaining() }
      )
      .toBe(true)
  }
  await expect
    .poll(
      () =>
        previews.evaluateAll((elements) =>
          elements.map((element) => {
            if (element instanceof HTMLImageElement) {
              return {
                kind: 'image',
                label: element.alt,
                ref: new URL(
                  element.currentSrc,
                  location.href
                ).searchParams.get('filename'),
                width: element.naturalWidth,
                height: element.naturalHeight
              }
            }
            if (element instanceof HTMLVideoElement) {
              return {
                label: element.parentElement?.getAttribute('aria-label'),
                ref: element.currentSrc
                  ? new URL(element.currentSrc, location.href).searchParams.get(
                      'filename'
                    )
                  : null,
                kind: 'video',
                width: element.videoWidth,
                height: element.videoHeight
              }
            }
            return null
          })
        ),
      { timeout: remaining() }
    )
    .toEqual(
      assets.map(({ filename, ref = filename, kind, width, height }) => ({
        kind,
        label: filename,
        ref,
        width: width ?? expect.any(Number),
        height: height ?? expect.any(Number)
      }))
    )
}
