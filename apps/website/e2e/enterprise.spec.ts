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
    await expect(page.getByText('LEAD OFFER')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'SUBSCRIBE NOW' })).toHaveCount(
      2
    )
    await expect(
      page.getByRole('link', { name: 'SUBSCRIBE NOW' }).first()
    ).toHaveAttribute('href', '/pricing')
    await expect(
      page.getByRole('link', { name: 'SUBSCRIBE NOW' }).last()
    ).toHaveAttribute('href', '/pricing')
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
      /MANAGED BUILDS\s*BETA/
    )
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByText('BETA', { exact: true })).toBeVisible()
    await expect(
      page.getByText(
        /deploy the same build anywhere, local or serverless cloud/
      )
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'CONTACT SALES' })).toHaveCount(
      0
    )
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: /One approved ComfyUI environment, everywhere your team runs it\./
      })
    ).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: 'BUILD', exact: true })
    ).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: 'REQUEST DEMO' }).first()
    ).toHaveAttribute('href', '/contact/')
    await expect(page.getByRole('link', { name: 'REQUEST DEMO' })).toHaveCount(
      3
    )
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'Stop rebuilding the operating layer around ComfyUI.'
      })
    ).toHaveCount(0)
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'One ComfyUI build for the whole team'
      })
    ).toBeVisible()
    for (const term of [
      'Environment packaging',
      'Node governance',
      'Onboarding and rollout'
    ]) {
      await expect(page.getByText(term, { exact: true })).toBeVisible()
    }
    await expect(
      page.getByText(/5,000\+ extensions and 60,000\+ community nodes/)
    ).toBeVisible()
    const stepsSection = page.locator('section').filter({
      has: page.getByRole('heading', {
        level: 2,
        name: 'From one working setup to an approved fleet.'
      })
    })
    await expect(stepsSection.getByRole('heading', { level: 3 })).toHaveText([
      'Define the build',
      'Build it once',
      'Update deliberately',
      'Roll out to the fleet'
    ])
    await expect(
      page.getByText(/dedicated GPU capacity, priority queueing/)
    ).toBeVisible()
  })
})
