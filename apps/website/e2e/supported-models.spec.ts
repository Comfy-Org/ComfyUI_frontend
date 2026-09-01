import { expect, test } from '@playwright/test'

test.describe('Supported model FAQ @smoke', () => {
  test('renders the same questions as the FAQPage schema', async ({ page }) => {
    await page.goto('/p/supported-models/grok-imagine/')

    const faqHeading = page.getByRole('heading', {
      name: 'Frequently Asked Questions'
    })
    await expect(faqHeading).toBeVisible()

    const visibleQuestions = await faqHeading
      .locator('xpath=../following-sibling::*')
      .getByRole('button')
      .allTextContents()
    const faqPage = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((scripts) => {
        const nodes = scripts.flatMap((script) => {
          const value = JSON.parse(script.textContent ?? '{}') as {
            '@graph'?: Array<Record<string, unknown>>
          }
          return value['@graph'] ?? []
        })
        return nodes.find((node) => node['@type'] === 'FAQPage') as {
          mainEntity: Array<{ name: string }>
        }
      })

    expect(visibleQuestions.map((question) => question.trim())).toEqual(
      faqPage.mainEntity.map((question) => question.name)
    )
  })
})
