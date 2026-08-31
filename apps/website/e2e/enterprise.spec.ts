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

    await page.goto('/enterprise/managed-builds')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      /One approved ComfyUI environment\.\s+Across your team and deployment targets\./
    )
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(
      page.getByRole('link', { name: 'REQUEST DEMO' }).first()
    ).toHaveAttribute('href', '/contact/')
  })
})
