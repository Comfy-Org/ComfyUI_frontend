import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

for (const vertical of [
  'vfx',
  'advertising',
  'film-animation',
  'architectural-visualization'
]) {
  for (const prefix of ['', '/zh-CN']) {
    test(`${prefix}/agency-led/${vertical}/ keeps the agency inquiry journey`, async ({
      page
    }) => {
      await page.goto(
        `${prefix}/agency-led/${vertical}/?utm_source=linkedin&utm_medium=paid-social&utm_campaign=agency_test`
      )
      await expect(
        page.getByRole('navigation', { name: 'Main navigation' })
      ).toBeVisible()
      const campaign = page.locator('[data-agency-campaign]')
      const hero = campaign.locator('[data-campaign-hero]')
      await expect(hero.getByRole('heading', { level: 1 })).toBeVisible()
      const contact = hero.getByRole('link').first()
      await expect(contact).toHaveAttribute(
        'href',
        `${prefix}/contact/?interest=${vertical}&campaign_type=agency-led&utm_source=linkedin&utm_medium=paid-social&utm_campaign=agency_test`
      )
      await hero.getByRole('link').last().click()
      await expect(page).toHaveURL(/#approach$/)
      await page.locator('#workflows').scrollIntoViewIfNeeded()
      const cards = campaign.getByTestId('hub-card-link')
      await expect(cards).toHaveCount(3)
      await expect
        .poll(() =>
          cards.evaluateAll((elements) =>
            elements.map((element) => element.getAttribute('href'))
          )
        )
        .toEqual(
          Array.from({ length: 3 }, () =>
            expect.stringMatching(
              /utm_source=linkedin&utm_medium=paid-social&utm_campaign=agency_test$/
            )
          )
        )
      await page.getByRole('contentinfo').scrollIntoViewIfNeeded()
      await expect(page.getByRole('contentinfo')).toBeVisible()
      await contact.click()
      await expect(page).toHaveURL(
        new RegExp(
          `${prefix}/contact/\\?interest=${vertical}&campaign_type=agency-led&utm_source=linkedin&utm_medium=paid-social&utm_campaign=agency_test$`
        )
      )
    })
  }
}
