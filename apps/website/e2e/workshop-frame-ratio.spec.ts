import { expect } from '@playwright/test'

import { test } from './fixtures/modelsAccount'

// Solid colour, tiny, and the only thing that matters about them is the shape:
// the notice compares ratios, not contents.
const LANDSCAPE_16_9 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAFElEQVR42mOIyptGEmIY1TAoNAAAfNDE4cOvQ+wAAAAASUVORK5CYII='
const PORTRAIT_9_16 =
  'iVBORw0KGgoAAAANSUhEUgAAAAkAAAAQCAIAAABLKsIUAAAAE0lEQVR42mOIypuGCzGMyg16OQAuFMThDwuslgAAAABJRU5ErkJggg=='
const WIDER_LANDSCAPE_16_9 =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAASCAIAAAC1qksFAAAAH0lEQVR42mOIyptGU8QwasGoBaMWjFowasGoBfSwAACcpROu+NZsLgAAAABJRU5ErkJggg=='

function frame(name: string, base64: string) {
  return { name, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') }
}

test('Seedance first/last frame warns about the stretch only while the shapes differ', async ({
  page
}) => {
  await page.goto(
    '/models/byteplus--seedance-2-5-first-last-frame--animate-images/'
  )
  const upload = (name: string) =>
    page
      .getByRole('group', { name, exact: true })
      .getByLabel(name, { exact: true })
  const first = upload('First frame')
  const last = upload('Last frame')
  const notice = page.getByTestId('frame-ratio-notice')

  // The page opens with both frames already filled from its worked example.
  // The suite serves the example's external images as the same 1x1 placeholder,
  // so this pins that an untouched page stays quiet, not the example's shapes.
  await expect(
    notice,
    'an untouched page must not greet the visitor with a warning'
  ).toHaveCount(0)

  await first.setInputFiles(frame('first.png', LANDSCAPE_16_9))
  await last.setInputFiles(frame('last.png', PORTRAIT_9_16))
  await expect(notice).toContainText('The last frame will be stretched')

  // Replacing the last frame with the same shape retires the notice on its own.
  await last.setInputFiles(frame('last.png', WIDER_LANDSCAPE_16_9))
  await expect(notice).toHaveCount(0)
})
