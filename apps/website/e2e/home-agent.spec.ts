import { expect } from '@playwright/test'

import { tAgent } from '@/components/agent/agentTranslations'
import { externalLinks } from '@/config/routes'
import { translationsFor } from '@/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

test.describe('Homepage Agent callout', () => {
  test.use({ reducedMotion: 'reduce' })

  for (const locale of ['en', 'zh-CN'] as const) {
    test(`introduces the Agent between Developer Platform and MiniMax (${locale})`, async ({
      page
    }) => {
      await page.goto(locale === 'en' ? '/' : '/zh-CN/')
      const { t } = translationsFor(locale)
      const title = `${tAgent('agentPage.hero.titleLine1', locale)} ${tAgent('agentPage.hero.titleLine2', locale)}`
      const callout = page.getByRole('region', { name: title, exact: true })
      const heading = callout.getByRole('heading', { level: 2, name: title })
      await heading.scrollIntoViewIfNeeded()
      await expect(heading).toBeVisible()
      await expect(
        callout.getByText(tAgent('agentPage.hero.subtitle', locale))
      ).toBeVisible()
      await expect(
        callout.getByRole('link', {
          name: tAgent('agentPage.cta', locale),
          exact: true
        })
      ).toHaveAttribute('href', externalLinks.cloud)
      await expect(
        callout.getByRole('region', {
          name: tAgent('agentPage.workflow.regionLabel', locale),
          exact: true
        })
      ).toBeVisible()
      const platform = await page
        .getByRole('heading', { name: t('platform.hero.badge'), exact: true })
        .boundingBox()
      const agent = await heading.boundingBox()
      const minimax = await page
        .getByRole('heading', {
          name: t('minimaxLicense.hero.title'),
          exact: true
        })
        .boundingBox()
      expect(platform).not.toBeNull()
      expect(agent).not.toBeNull()
      expect(minimax).not.toBeNull()
      if (!platform || !agent || !minimax)
        throw new Error('Missing homepage section heading')
      expect(platform.y + platform.height).toBeLessThan(agent.y)
      expect(agent.y + agent.height).toBeLessThan(minimax.y)
    })
  }

  test('keeps the mobile workflow visible and MiniMax buttons compact @mobile', async ({
    page
  }) => {
    await page.goto('/')
    const workflow = page.getByRole('region', {
      name: tAgent('agentPage.workflow.mobile.label', 'en'),
      exact: true
    })
    await workflow.scrollIntoViewIfNeeded()
    await expect(workflow).toBeVisible()
    await expect(
      workflow.getByRole('img', { name: 'Comfy Agent', exact: true })
    ).toBeVisible()
    await expect(
      workflow.getByRole('img', {
        name: tAgent('agentPage.workflow.userCursorLabel', 'en'),
        exact: true
      })
    ).toBeVisible()
    const { t } = translationsFor('en')
    for (const key of [
      'minimaxLicense.hero.primaryCta',
      'minimaxLicense.hero.secondaryCta'
    ] as const) {
      const button = page.getByRole('link', { name: t(key), exact: true })
      await button.scrollIntoViewIfNeeded()
      await expect(button).toBeVisible()
      const bounds = await button.boundingBox()
      const viewport = page.viewportSize()
      if (!bounds || !viewport)
        throw new Error('Missing mobile button geometry')
      expect(bounds.width).toBeLessThan(viewport.width - 64)
      expect(
        Math.abs(bounds.x + bounds.width / 2 - viewport.width / 2)
      ).toBeLessThan(2)
    }
  })
})
