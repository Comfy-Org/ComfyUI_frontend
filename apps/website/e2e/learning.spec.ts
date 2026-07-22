import { expect } from '@playwright/test'

import { learningTutorials } from '../src/data/learningTutorials'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const tutorialButtonName = (title: string, locale: 'en' | 'zh-CN') =>
  `${t('learning.tutorials.titlePrefix', locale)} ${title}`

test.describe('Learning page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/learning')
  })

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Learning - Comfy')
  })

  test('hero headline references ComfyUI', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
    await expect(heading).toContainText(t('learning.heroTitle.before', 'en'))
    await expect(heading).toContainText('ComfyUI')
    await expect(heading).toContainText(t('learning.heroTitle.line2', 'en'))
  })

  test('featured workflow section shows title and author', async ({ page }) => {
    await expect(
      page.getByRole('heading', {
        name: t('learning.featured.title', 'en'),
        level: 2
      })
    ).toBeVisible()
    await expect(
      page.getByText(t('learning.featured.author', 'en'))
    ).toBeVisible()
  })

  test('renders every tutorial from the data source', async ({ page }) => {
    await expect(
      page.getByRole('heading', {
        name: t('learning.tutorials.heading', 'en'),
        level: 2
      })
    ).toBeVisible()

    for (const tutorial of learningTutorials) {
      await expect(
        page.getByRole('button', {
          name: tutorialButtonName(tutorial.title.en, 'en')
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

test.describe('Learning tutorial dialog', () => {
  test('opens a tutorial video and dismisses via the close button', async ({
    page
  }) => {
    const [firstTutorial] = learningTutorials
    await page.goto('/learning')

    const openButton = page.getByRole('button', {
      name: tutorialButtonName(firstTutorial.title.en, 'en')
    })
    await openButton.scrollIntoViewIfNeeded()

    const dialog = page.getByRole('dialog', { name: firstTutorial.title.en })
    // TutorialsSection is hydrated via `client:visible`; retry the click until
    // Vue responds by opening the dialog.
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

  test('dismisses the dialog with the Escape key', async ({ page }) => {
    const [firstTutorial] = learningTutorials
    await page.goto('/learning')

    const openButton = page.getByRole('button', {
      name: tutorialButtonName(firstTutorial.title.en, 'en')
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
  test('renders localized title, headings, and tutorials', async ({ page }) => {
    await page.goto('/zh-CN/learning')

    await expect(page).toHaveTitle('学习 - Comfy')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /[一-鿿]/
    )
    await expect(
      page.getByRole('heading', {
        name: t('learning.tutorials.heading', 'zh-CN'),
        level: 2
      })
    ).toBeVisible()

    const [firstTutorial] = learningTutorials
    await expect(
      page.getByRole('button', {
        name: tutorialButtonName(firstTutorial.title['zh-CN'], 'zh-CN')
      })
    ).toBeVisible()
  })
})
