import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const destinations = [
  'be0889296f65-be0889296f65',
  '58a3f7167dba-58a3f7167dba',
  '8f2cf0df5da6-8f2cf0df5da6',
  '7a6ab8b6e694-7a6ab8b6e694',
  'e0df9e9c7683-e0df9e9c7683',
  '171dea657096-171dea657096'
]

for (const locale of [
  {
    path: '/vfx/',
    contact: '/contact/',
    heading: 'Build your VFX pipeline with Comfy.',
    explore: 'Explore VFX workflows',
    sales: 'Talk to our team',
    featured: 'FEATURED · STAFF PICK',
    formId: '94e05eab-1373-47f7-ab5e-d84f9e6aa262'
  },
  {
    path: '/zh-CN/vfx/',
    contact: '/zh-CN/contact/',
    heading: '用 Comfy 构建 你的视觉特效流程。',
    explore: '探索特效工作流',
    sales: '联系我们的团队',
    featured: '精选 · 官方推荐',
    formId: '6885750c-02ef-4aa2-ba0d-213be9cccf93'
  }
]) {
  test(`${locale.path} visitors can reach the real workflows and sales form`, async ({
    page
  }) => {
    await page.goto(`${locale.path}?utm_source=linkedin&utm_campaign=vfx`)
    await expect(
      page.getByRole('navigation', { name: 'Main navigation' })
    ).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      locale.heading
    )
    await page.getByRole('link', { name: locale.explore, exact: true }).click()
    await expect(page).toHaveURL(/#workflows$/)
    const workflows = page.locator('#workflows')
    const cards = workflows.getByTestId('hub-card-link')
    await expect(cards).toHaveCount(6)
    for (const [index, slug] of destinations.entries()) {
      await expect(cards.nth(index)).toHaveAttribute(
        'href',
        `https://comfy.org/workflows/${slug}/?utm_source=linkedin&utm_campaign=vfx`
      )
    }
    await expect(
      workflows.getByRole('region', { name: locale.featured }).getByRole('link')
    ).toHaveCount(3)
    await expect(
      workflows.getByRole('link', {
        name: /Storyboard to Seedance|故事板.*Seedance/
      })
    ).toHaveAttribute(
      'href',
      'https://comfy.org/workflows/f4e29143100c-f4e29143100c/?utm_source=linkedin&utm_campaign=vfx'
    )
    const sales = page
      .getByRole('link', { name: locale.sales, exact: true })
      .first()
    await expect(sales).toHaveAttribute(
      'href',
      `${locale.contact}?interest=vfx&utm_source=linkedin&utm_campaign=vfx`
    )
    await sales.click()
    await expect(page).toHaveURL(
      new RegExp(
        `${locale.contact}\\?interest=vfx&utm_source=linkedin&utm_campaign=vfx$`
      )
    )
    await expect(page.getByTestId('hubspot-form-embed')).toHaveAttribute(
      'data-form-id',
      locale.formId
    )
  })
}

test('VFX mobile visitors get site navigation, footer and working FAQ @mobile', async ({
  page
}) => {
  await page.goto('/vfx/')
  await expect(
    page.getByRole('navigation', { name: 'Main navigation' })
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Can my team run Comfy locally?' })
    .click()
  await expect(
    page.getByRole('region', { name: 'Can my team run Comfy locally?' })
  ).toContainText('ComfyUI is open source')
  await expect(page.getByRole('contentinfo')).toBeVisible()
})
