import { expect } from '@playwright/test'
import { test } from '@website/e2e/fixtures/blockExternalMedia'
import axe from 'axe-core'

declare global {
  interface Window {
    axe: typeof axe
  }
}

const fixtures = [
  ['website-common-nodebadge--with-logo', 'WORKS'],
  ['website-ui-badge--accent', 'Available now'],
  ['website-ui-badge--callout', 'Featured'],
  ['website-common-productherobadge--default', 'DESKTOP'],
  ['website-blocks-cardarticle01--default', 'Connect coding agents to ComfyUI'],
  ['website-guidelines-proposed-components--status', 'Proposals only.'],
  ['website-guidelines-buttons-and-arrows--cta-buttons', 'GET AN API KEY']
] as const

test.describe('Marketing catalog', { tag: '@smoke' }, () => {
  for (const [id, text] of fixtures) {
    test(id, async ({ page }, testInfo) => {
      await page.goto(
        `/iframe.html?id=${id}&viewMode=story&globals=a11y.manual:true`
      )
      await expect(page.getByText(text, { exact: false }).first()).toBeVisible()
      await page.evaluate(async () => document.fonts.ready)
      await expect
        .poll(() =>
          page
            .locator('#storybook-root img')
            .evaluateAll((images) =>
              images.every(
                (image) =>
                  image instanceof HTMLImageElement &&
                  image.complete &&
                  image.naturalWidth > 0
              )
            )
        )
        .toBe(true)
      await page.addScriptTag({ content: axe.source })
      await expect(async () => {
        const violations = await page.evaluate(async () => {
          const result = await window.axe.run('#storybook-root', {
            runOnly: ['wcag2a', 'wcag2aa'],
            rules: { 'color-contrast': { enabled: false } }
          })
          return result.violations.map(({ id, description }) => ({
            id,
            description
          }))
        })
        expect(violations).toEqual([])
      }).toPass({ timeout: 5000 })
      await testInfo.attach('rendered-story', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png'
      })
    })
  }

  test('FAQ opens and closes with the keyboard', async ({ page }) => {
    await page.goto(
      '/iframe.html?id=website-common-faqsection--mobile&viewMode=story&globals=a11y.manual:true'
    )
    const question = page.getByRole('button').first()
    await expect(question).toHaveAttribute('aria-expanded', 'false')
    await question.focus()
    await page.keyboard.press('Enter')
    await expect(question).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Enter')
    await expect(question).toHaveAttribute('aria-expanded', 'false')
  })
})
