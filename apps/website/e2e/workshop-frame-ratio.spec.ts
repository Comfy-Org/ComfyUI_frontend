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
  const group = (name: string) => page.getByRole('group', { name, exact: true })
  const upload = (name: string) => group(name).getByLabel(name, { exact: true })
  // The notice is legitimately down while a frame's size is unknown, and a
  // replaced frame is unmeasured until it decodes, so every assertion of
  // absence here first waits for the frames it is about to judge.
  const decoded = (name: string, width: number) =>
    expect(group(name).getByRole('img')).toHaveJSProperty('naturalWidth', width)
  const first = upload('First frame')
  const last = upload('Last frame')
  const notice = page.getByTestId('frame-ratio-notice')

  // The page opens with both frames already filled from its worked example.
  // The suite serves the example's external images as the same 1x1 placeholder,
  // so this pins that an untouched page stays quiet, not the example's shapes.
  await decoded('First frame', 1)
  await decoded('Last frame', 1)
  await expect(
    notice,
    'an untouched page must not greet the visitor with a warning'
  ).toHaveCount(0)

  // Changing only the last frame raises the notice against the example's own
  // first frame, which is what makes the silence above an answer about two
  // measured frames rather than about one that had not loaded yet.
  await last.setInputFiles(frame('last.png', PORTRAIT_9_16))
  await expect(notice).toContainText('The frames are different shapes')

  await first.setInputFiles(frame('first.png', LANDSCAPE_16_9))
  await expect(notice).toContainText('The frames are different shapes')

  // Replacing the last frame with the same shape retires the notice on its own.
  await last.setInputFiles(frame('last.png', WIDER_LANDSCAPE_16_9))
  await decoded('Last frame', 32)
  await expect(notice).toHaveCount(0)

  // And that silence is about the replacement rather than a cleared or a stale
  // size: turning the first frame portrait has to bring the warning back.
  await first.setInputFiles(frame('first.png', PORTRAIT_9_16))
  await expect(notice).toContainText('The frames are different shapes')
})
