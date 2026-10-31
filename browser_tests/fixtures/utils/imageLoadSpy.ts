import type { Page } from '@playwright/test'

type TrackedImage = { src: string; handled: boolean }

type ImageLoadWindow = Window & {
  __trackedImages?: Map<HTMLImageElement, TrackedImage>
  __restoreImageSrc?: () => void
}

/** Tracks each image's latest `src` and whether all its `load` listeners have run. */
export async function trackHandledImageLoads(page: Page) {
  await page.evaluate(() => {
    const w = window as ImageLoadWindow
    const src = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      'src'
    )!
    const tracked = new Map<HTMLImageElement, TrackedImage>()
    w.__trackedImages = tracked
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      ...src,
      set(this: HTMLImageElement, value: string) {
        const entry = { src: value, handled: false }
        tracked.set(this, entry)
        this.addEventListener(
          'load',
          () =>
            setTimeout(() => {
              entry.handled = true
            }),
          { once: true }
        )
        src.set!.call(this, value)
      }
    })
    w.__restoreImageSrc = () =>
      Object.defineProperty(HTMLImageElement.prototype, 'src', src)
  })
}

/** Counts images whose `src` contains `urlPart`, and how many of them have had their `load` handled. */
export function imageLoadProgress(page: Page, urlPart: string) {
  return page.evaluate((part) => {
    const images = [
      ...((window as ImageLoadWindow).__trackedImages?.values() ?? [])
    ].filter(({ src }) => src.includes(part))
    return {
      started: images.length,
      handled: images.filter(({ handled }) => handled).length
    }
  }, urlPart)
}

export async function restoreImageSrc(page: Page) {
  await page.evaluate(() => (window as ImageLoadWindow).__restoreImageSrc?.())
}
