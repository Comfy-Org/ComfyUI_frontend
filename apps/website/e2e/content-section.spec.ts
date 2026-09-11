import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const M4_PRO_14_INCH_VIEWPORT = { width: 2016, height: 1310 }
const LAST_SECTION_HASH = '#contact'

test.describe(
  'ContentSection scroll-spy @smoke',
  {
    annotation: [
      {
        type: 'issue',
        description:
          'https://linear.app/comfyorg/issue/FE-604/bug-bottom-badge-not-activating-on-scroll-at-high-resolution-3024x1964'
      },
      {
        type: 'environment',
        description:
          '14" MacBook M4 Pro logical viewport reported in FE-604; /privacy-policy reproduces because of its short trailing sections'
      }
    ]
  },
  () => {
    test.use({ viewport: M4_PRO_14_INCH_VIEWPORT })

    test('activates the last badge when user scrolls to the bottom', async ({
      page
    }) => {
      await page.goto('/privacy-policy')

      const sidebarNav = page.getByRole('navigation', {
        name: 'Category filter'
      })
      const badges = sidebarNav.getByRole('button')
      const lastBadge = badges.last()

      await expect(badges.first()).toHaveAttribute('aria-pressed', 'true')
      await expect(lastBadge).toHaveAttribute('aria-pressed', 'false')

      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight)
      )

      await expect(lastBadge).toHaveAttribute('aria-pressed', 'true')
    })

    test('activates the last badge when page mounts already at the bottom via trailing hash', async ({
      page
    }) => {
      await page.goto(`/privacy-policy${LAST_SECTION_HASH}`)

      const sidebarNav = page.getByRole('navigation', {
        name: 'Category filter'
      })
      const lastBadge = sidebarNav.getByRole('button').last()

      await expect(lastBadge).toHaveAttribute('aria-pressed', 'true')
    })
  }
)
