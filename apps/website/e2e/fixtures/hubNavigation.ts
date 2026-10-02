import type { Page } from '@playwright/test'

export async function observeHubNavigation(page: Page) {
  const probe = await page.evaluateHandle(() => {
    const observed = {
      frames: 0,
      bannerReappeared: false,
      tabsDisappeared: false,
      loaderAppeared: false,
      headerMoved: false,
      tabsMoved: false
    }
    const header = document.querySelector('[aria-label="Main navigation"]')
    const headerY = header?.getBoundingClientRect().y
    const tabsY = document
      .querySelector('[data-testid="catalogue-tabs"]')
      ?.getBoundingClientRect().y
    let frame: number
    function record() {
      observed.frames++
      observed.bannerReappeared ||= Boolean(
        document
          .querySelector('[data-slot="announcement-banner"]')
          ?.checkVisibility()
      )
      observed.tabsDisappeared ||= !document
        .querySelector('[data-testid="catalogue-tabs"]')
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
      observed.tabsMoved ||=
        document
          .querySelector('[data-testid="catalogue-tabs"]')
          ?.getBoundingClientRect().y !== tabsY
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
