import type { Page } from '@playwright/test'

type TrackedImage = { src: string; handled: boolean }

type ImageLoadWindow = Window & {
  __trackedImages?: Map<object, TrackedImage>
  __restoreImageSrc?: () => void
}

export async function trackHandledImageLoads(page: Page) {
  await page.evaluate(() => {
    const w = window as ImageLoadWindow
    const src = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      'src'
    )!
    const tracked = new Map<object, TrackedImage>()
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
    const nativePostMessage = Worker.prototype.postMessage
    Worker.prototype.postMessage = new Proxy(nativePostMessage, {
      apply(postMessage, worker: Worker, args: unknown[]) {
        const [message] = args
        if (
          message &&
          typeof message === 'object' &&
          'id' in message &&
          'source' in message &&
          typeof message.source === 'string'
        ) {
          const entry = { src: message.source, handled: false }
          const { id } = message
          tracked.set(message, entry)
          const onReply = (event: MessageEvent) => {
            if (event.data?.id !== id) return
            worker.removeEventListener('message', onReply)
            setTimeout(() => {
              entry.handled = true
            })
          }
          worker.addEventListener('message', onReply)
        }
        Reflect.apply(postMessage, worker, args)
      }
    })
    w.__restoreImageSrc = () => {
      Object.defineProperty(HTMLImageElement.prototype, 'src', src)
      Worker.prototype.postMessage = nativePostMessage
    }
  })
}

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
