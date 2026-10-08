import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

for (const vertical of [
  'advertising',
  'film-animation',
  'architectural-visualization'
]) {
  for (const prefix of ['', '/zh-CN']) {
    test(`${prefix}/${vertical}/ preserves the ad journey`, async ({
      page
    }) => {
      await page.goto(
        `${prefix}/${vertical}/?utm_source=linkedin&utm_medium=ads&utm_campaign=comfy_vfx`
      )
      await expect(
        page.getByRole('navigation', { name: 'Main navigation' })
      ).toBeVisible()
      const campaign = page.locator('[data-industry-campaign]')
      const hero = campaign.locator('[data-campaign-hero]')
      await expect(hero.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(hero.getByRole('link').last()).toHaveAttribute(
        'href',
        `${prefix}/contact/?interest=${vertical}&utm_source=linkedin&utm_medium=ads&utm_campaign=comfy_vfx`
      )
      await hero.getByRole('link').first().click()
      await expect(page).toHaveURL(/#workflows$/)
      const cards = campaign.getByTestId('hub-card-link')
      await expect(cards).toHaveCount(6)
      await expect
        .poll(() =>
          cards.evaluateAll((elements) =>
            elements.map((element) => element.getAttribute('href'))
          )
        )
        .toEqual(
          Array.from({ length: 6 }, () =>
            expect.stringMatching(
              /utm_source=linkedin&utm_medium=ads&utm_campaign=comfy_vfx$/
            )
          )
        )
      const faq = campaign
        .locator('[id^="faq-trigger-"]')
        .first()
        .getByRole('button')
      await faq.scrollIntoViewIfNeeded()
      await expect(
        page.locator('astro-island').filter({
          has: page.getByRole('button', {
            name: await faq.innerText(),
            exact: true
          })
        })
      ).not.toHaveAttribute('ssr', /.*/)
      await faq.click()
      await expect(faq).toHaveAttribute('aria-expanded', 'true')
      await expect(page.getByRole('contentinfo')).toBeVisible()
    })
  }
}
