import type { Page } from '@playwright/test'

type ImageLoadWindow = Window & {
  __handledImageLoads?: string[]
  __restoreImageSrc?: () => void
}

/** Records each image URL once all of its `load` listeners have run. */
export async function trackHandledImageLoads(page: Page) {
  await page.evaluate(() => {
    const w = window as ImageLoadWindow
    const src = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      'src'
    )!
    w.__handledImageLoads = []
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      ...src,
      set(this: HTMLImageElement, value: string) {
        this.addEventListener(
          'load',
          () => setTimeout(() => w.__handledImageLoads?.push(this.src)),
          { once: true }
        )
        src.set!.call(this, value)
      }
    })
    w.__restoreImageSrc = () =>
      Object.defineProperty(HTMLImageElement.prototype, 'src', src)
  })
}

export function hasHandledImageLoad(page: Page, urlPart: string) {
  return page.evaluate(
    (part) =>
      (window as ImageLoadWindow).__handledImageLoads?.some((url) =>
        url.includes(part)
      ) ?? false,
    urlPart
  )
}

export async function restoreImageSrc(page: Page) {
  await page.evaluate(() => (window as ImageLoadWindow).__restoreImageSrc?.())
}
