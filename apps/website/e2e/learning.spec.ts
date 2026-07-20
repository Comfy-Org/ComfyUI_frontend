import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import {
  featuredFor,
  filterByCategory,
  learningCategories,
  learningTutorials,
  populatedCategories
} from '../src/data/learningTutorials'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const playButtonName = (title: string, locale: 'en' | 'zh-CN') =>
  `${t('player.play', locale)} ${title}`

const categoryNav = (page: Page, locale: 'en' | 'zh-CN' = 'en') =>
  page.getByRole('navigation', { name: t('learning.categoryNav', locale) })

test.describe('Learning page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/learning')
  })

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Learning - Comfy')
  })

  test('sidebar shows the page heading and a link per category', async ({
    page
  }) => {
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toHaveText(t('learning.title', 'en'))

    const nav = categoryNav(page)
    await expect(nav.locator('a[href="/learning"]')).toHaveAttribute(
      'aria-current',
      'page'
    )
    for (const category of populatedCategories) {
      const link = nav.locator(`a[href="/learning/${category}"]`)
      await expect(link).toBeVisible()
      await expect(link).toContainText(
        String(filterByCategory(category).length)
      )
    }
  })

  test('omits categories that have no tutorials', async ({ page }) => {
    const nav = categoryNav(page)
    const emptyCategories = learningCategories.filter(
      (category) => !populatedCategories.includes(category)
    )
    for (const category of emptyCategories) {
      await expect(nav.locator(`a[href="/learning/${category}"]`)).toHaveCount(
        0
      )
    }
  })

  test('featured banner promotes the curated global pick', async ({ page }) => {
    const featured = featuredFor()
    if (!featured) throw new Error('expected a featured tutorial on /learning')
    await expect(
      page.getByText(t('learning.featuredBadge', 'en')).first()
    ).toBeVisible()
    await expect(
      page.getByRole('heading', {
        name: `${t('learning.tutorials.titlePrefix', 'en')} ${featured.title.en}`,
        level: 2
      })
    ).toBeVisible()
  })

  test('renders every tutorial from the data source', async ({ page }) => {
    for (const tutorial of learningTutorials) {
      await expect(
        page.getByRole('button', {
          name: playButtonName(tutorial.title.en, 'en')
        })
      ).toBeVisible()
    }
  })

  test('tutorials with a workflow link expose an external Try Workflow link', async ({
    page
  }) => {
    const linkedTutorials = learningTutorials.filter(
      (tutorial) => tutorial.href
    )
    const workflowLinks = page.getByRole('link', {
      name: t('cta.tryWorkflow', 'en')
    })
    const hrefs = await workflowLinks.evaluateAll((links) =>
      links.map((link) => link.getAttribute('href'))
    )
    for (const tutorial of linkedTutorials) {
      expect(hrefs).toContain(tutorial.href)
    }
  })

  test('call to action links to contact sales', async ({ page }) => {
    await expect(
      page.getByRole('heading', {
        name: t('learning.cta.heading', 'en'),
        level: 2
      })
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: t('learning.cta.contactSales', 'en') })
    ).toHaveAttribute('href', '/contact')
  })
})

test.describe('Learning category pages @smoke', () => {
  test('sidebar links navigate to the category page', async ({ page }) => {
    await page.goto('/learning')
    await categoryNav(page).locator('a[href="/learning/vfx"]').click()

    await expect(page).toHaveURL('/learning/vfx')
    await expect(
      categoryNav(page).locator('a[href="/learning/vfx"]')
    ).toHaveAttribute('aria-current', 'page')
  })

  for (const category of populatedCategories) {
    test(`/learning/${category} lists only its own tutorials`, async ({
      page
    }) => {
      await page.goto(`/learning/${category}`)

      const label = t(`learning.categories.${category}`, 'en')
      await expect(page).toHaveTitle(`${label} Learning - Comfy`)

      for (const tutorial of learningTutorials) {
        const playButton = page.getByRole('button', {
          name: playButtonName(tutorial.title.en, 'en')
        })
        if (tutorial.category === category) {
          await expect(playButton).toBeVisible()
        } else {
          await expect(playButton).toHaveCount(0)
        }
      }
    })
  }
})

test.describe('Learning tutorial dialog', () => {
  test('opens a tutorial video and dismisses via the close button', async ({
    page
  }) => {
    const [firstTutorial] = learningTutorials
    await page.goto('/learning')

    const openButton = page.getByRole('button', {
      name: playButtonName(firstTutorial.title.en, 'en')
    })
    await openButton.scrollIntoViewIfNeeded()

    const dialog = page.getByRole('dialog', { name: firstTutorial.title.en })
    // The section is hydrated via `client:load`; retry the click until Vue
    // responds by opening the dialog.
    await expect(async () => {
      await openButton.click()
      await expect(dialog).toBeVisible({ timeout: 1_000 })
    }).toPass({ timeout: 10_000 })

    await expect(
      dialog.getByRole('heading', { level: 2, name: firstTutorial.title.en })
    ).toBeVisible()

    await dialog
      .getByRole('button', { name: t('gallery.detail.close', 'en') })
      .click()
    await expect(dialog).toBeHidden()
  })

  test('opens a tutorial video from its title', async ({ page }) => {
    const [firstTutorial] = learningTutorials
    await page.goto('/learning')

    const titleButton = page.getByRole('button', {
      name: `${t('learning.tutorials.titlePrefix', 'en')} ${firstTutorial.title.en}`
    })
    await titleButton.scrollIntoViewIfNeeded()

    const dialog = page.getByRole('dialog', { name: firstTutorial.title.en })
    await expect(async () => {
      await titleButton.click()
      await expect(dialog).toBeVisible({ timeout: 1_000 })
    }).toPass({ timeout: 10_000 })
  })

  test('dismisses the dialog with the Escape key', async ({ page }) => {
    const [firstTutorial] = learningTutorials
    await page.goto('/learning')

    const openButton = page.getByRole('button', {
      name: playButtonName(firstTutorial.title.en, 'en')
    })
    await openButton.scrollIntoViewIfNeeded()

    const dialog = page.getByRole('dialog', { name: firstTutorial.title.en })
    await expect(async () => {
      await openButton.click()
      await expect(dialog).toBeVisible({ timeout: 1_000 })
    }).toPass({ timeout: 10_000 })

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })
})

test.describe('Learning page (zh-CN) @smoke', () => {
  test('renders localized title, sidebar, and tutorials', async ({ page }) => {
    await page.goto('/zh-CN/learning')

    await expect(page).toHaveTitle('学习 - Comfy')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /[一-鿿]/
    )

    const nav = categoryNav(page, 'zh-CN')
    for (const category of populatedCategories) {
      await expect(
        nav.locator(`a[href="/zh-CN/learning/${category}"]`)
      ).toBeVisible()
    }

    const [firstTutorial] = learningTutorials
    await expect(
      page.getByRole('button', {
        name: playButtonName(firstTutorial.title['zh-CN'], 'zh-CN')
      })
    ).toBeVisible()
  })
})
