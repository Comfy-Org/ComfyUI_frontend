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
  kind: Extract<MediaKind, 'image' | 'video'>
  width: number
  height: number
  visible: boolean
}

export async function dropAssets(
  page: Page,
  panel: Locator,
  assets: ExpectedAssetPreview[]
) {
  for (const { filename, kind } of assets) {
    const payload: DraggedAssetInfo = {
      filename,
      subfolder: '',
      type: 'output',
      attachment_ref: filename,
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
    await panel.dispatchEvent('drop', { dataTransfer })
    await dataTransfer.dispose()
  }
}

export async function expectAssets(
  panel: Locator,
  assets: ExpectedAssetPreview[],
  timeout = 10_000
) {
  const previews = panel.getByTestId(/^reply-(image|video)-preview$/)
  await expect(previews).toHaveCount(assets.length, { timeout })
  for (const [index, { visible }] of assets.entries()) {
    await expect(previews.nth(index)).toBeVisible({ visible, timeout })
  }
  await expect
    .poll(
      () =>
        previews.evaluateAll((elements) =>
          elements.map((element) => {
            if (element instanceof HTMLImageElement) {
              return {
                filename: element.alt,
                kind: 'image',
                width: element.naturalWidth,
                height: element.naturalHeight
              }
            }
            if (element instanceof HTMLVideoElement) {
              return {
                filename: element.currentSrc
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
      { timeout }
    )
    .toEqual(
      assets.map(({ filename, kind, width, height }) => ({
        filename,
        kind,
        width,
        height
      }))
    )
}
