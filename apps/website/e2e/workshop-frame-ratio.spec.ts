import { expect } from '@playwright/test'

import { test } from './fixtures/modelsAccount'
import { openModelPage } from './fixtures/islands'

// Solid colour, tiny, and the only thing that matters about them is the shape:
// the notice compares ratios, not contents.
const LANDSCAPE_16_9 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAFElEQVR42mOIyptGEmIY1TAoNAAAfNDE4cOvQ+wAAAAASUVORK5CYII='
const PORTRAIT_9_16 =
  'iVBORw0KGgoAAAANSUhEUgAAAAkAAAAQCAIAAABLKsIUAAAAE0lEQVR42mOIypuGCzGMyg16OQAuFMThDwuslgAAAABJRU5ErkJggg=='
const WIDER_LANDSCAPE_16_9 =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAASCAIAAAC1qksFAAAAH0lEQVR42mOIyptGU8QwasGoBaMWjFowasGoBfSwAACcpROu+NZsLgAAAABJRU5ErkJggg=='

declare global {
  interface Window {
    __measuredFrames?: string[]
  }
}

function frame(name: string, base64: string) {
  return { name, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') }
}

test('Seedance first/last frame warns about the stretch only while the shapes differ', async ({
  page
}) => {
  // `useFrameSize` measures a detached `new Image()` carrying its own object
  // URL, never the preview element the page renders, so waiting for that
  // preview says nothing about whether the comparison has run. The readiness
  // signal has to come from the measuring image itself. The ledger chains onto
  // the composable's own `onload` rather than racing it on a second listener,
  // so a recorded frame is one whose size the composable has already taken.
  await page.addInitScript(() => {
    const measured: string[] = []
    window.__measuredFrames = measured
    const Native = window.Image
    window.Image = class extends Native {
      override set onload(handler: ((event: Event) => void) | null) {
        super.onload = handler
          ? (event: Event) => {
              handler.call(this, event)
              measured.push(`${this.naturalWidth}x${this.naturalHeight}`)
            }
          : handler
      }
      override get onload() {
        return super.onload
      }
    }
  })

  await openModelPage(
    page,
    '/models/byteplus--seedance-2-5-first-last-frame--animate-images/'
  )
  const group = (name: string) => page.getByRole('group', { name, exact: true })
  const upload = (name: string) => group(name).getByLabel(name, { exact: true })
  const first = upload('First frame')
  const last = upload('Last frame')
  const notice = page.getByTestId('frame-ratio-notice')

  const measured = (shape: string, count = 1) =>
    expect
      .poll(() =>
        page.evaluate(
          (want) =>
            (window.__measuredFrames ?? []).filter((m) => m === want).length,
          shape
        )
      )
      .toBeGreaterThanOrEqual(count)

  // The size lands in a ref, so the notice it drives is one Vue flush behind
  // the measurement. Two frames put the assertion after that render.
  const rendered = () =>
    page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    )

  // The page opens with both frames already filled from its worked example.
  // The suite serves the example's external images as the same 1x1 placeholder,
  // so this pins that an untouched page stays quiet, not the example's shapes.
  await measured('1x1', 2)
  await rendered()
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

  // Replacing the last frame with the same shape retires the notice on its own,
  // and the silence is only an answer once the replacement has been measured.
  await last.setInputFiles(frame('last.png', WIDER_LANDSCAPE_16_9))
  await measured('32x18')
  await rendered()
  await expect(notice).toHaveCount(0)

  // And that silence is about the replacement rather than a cleared or a stale
  // size: turning the first frame portrait has to bring the warning back.
  await first.setInputFiles(frame('first.png', PORTRAIT_9_16))
  await expect(notice).toContainText('The frames are different shapes')
})
