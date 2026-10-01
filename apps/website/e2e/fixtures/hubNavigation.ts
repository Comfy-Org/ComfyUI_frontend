import type { Page } from '@playwright/test'

export async function observeHubNavigation(page: Page) {
  const probe = await page.evaluateHandle(() => {
    const observed = {
      frames: 0,
      bannerReappeared: false,
      spacesDisappeared: false,
      loaderAppeared: false,
      headerMoved: false,
      spacesMoved: false
    }
    const header = document.querySelector('[aria-label="Main navigation"]')
    const headerY = header?.getBoundingClientRect().y
    const spacesY = document
      .querySelector('[data-testid="hub-space-nav"]')
      ?.getBoundingClientRect().y
    let frame: number
    function record() {
      observed.frames++
      observed.bannerReappeared ||= Boolean(
        document
          .querySelector('[data-slot="announcement-banner"]')
          ?.checkVisibility()
      )
      observed.spacesDisappeared ||= !document
        .querySelector('[data-testid="hub-space-nav"]')
        ?.checkVisibility()
      observed.loaderAppeared ||= Boolean(
        document
          .querySelector(
            '[data-testid="models-loading"], [data-testid="workshop-loading"]'
          )
          ?.checkVisibility()
      )
      observed.headerMoved ||=
        document
          .querySelector('[aria-label="Main navigation"]')
          ?.getBoundingClientRect().y !== headerY
      observed.spacesMoved ||=
        document
          .querySelector('[data-testid="hub-space-nav"]')
          ?.getBoundingClientRect().y !== spacesY
      frame = requestAnimationFrame(record)
    }
    record()
    return {
      finish() {
        cancelAnimationFrame(frame)
        return observed
      }
    }
  })
  return {
    async finish() {
      const result = await probe.evaluate((observer) => observer.finish())
      await probe.dispose()
      return result
    }
  }
}
