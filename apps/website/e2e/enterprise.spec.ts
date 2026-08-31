import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Enterprise pages @smoke', () => {
  test('renders the canonical Enterprise offer and Managed Builds path', async ({
    page
  }) => {
    await page.goto('/enterprise')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      /Govern ComfyUI across\s+every team and runtime\./
    )
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(
      page.getByRole('link', { name: 'REQUEST DEMO' }).first()
    ).toHaveAttribute('href', '/contact/')
    await expect(
      page.getByRole('link', { name: 'VIEW MANAGED BUILDS' }).first()
    ).toHaveAttribute('href', '/enterprise/managed-builds/')
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'Capacity and support for production.'
      })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', {
        level: 3,
        name: 'Dedicated GPU capacity'
      })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', {
        level: 3,
        name: 'Custom SLAs and support'
      })
    ).toBeVisible()
    await expect(page.getByText(/Builders, not advisors\./)).toBeVisible()

    await page.goto('/enterprise/managed-builds')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'MANAGED BUILDS'
    )
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: /One approved ComfyUI environment, everywhere your team runs it\./
      })
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'START BUILDING' })
    ).toHaveAttribute('href', '/contact/')
    await expect(
      page.getByRole('link', { name: 'REQUEST DEMO' }).first()
    ).toHaveAttribute('href', '/contact/')
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'Stop rebuilding the operating layer around ComfyUI.'
      })
    ).toBeVisible()
    await expect(
      page.getByText(/5,000\+ extensions and 60,000\+ community nodes/)
    ).toBeVisible()
    await expect(
      page.getByText(/dedicated GPU capacity, priority queueing/)
    ).toBeVisible()
  })
})
