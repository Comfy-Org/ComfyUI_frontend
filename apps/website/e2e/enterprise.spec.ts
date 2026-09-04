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
      page.getByRole('heading', {
        level: 2,
        name: 'Govern the build, models, people, and usage.'
      })
    ).toBeVisible()
    const governRows = page.locator('section').filter({
      has: page.getByText('Build policy', { exact: true })
    })
    for (const term of [
      'Build policy',
      'Model policy and BYOK',
      'People and access',
      'Usage visibility and audit requirements'
    ]) {
      await expect(
        governRows.locator('dl').getByText(term, { exact: true })
      ).toBeVisible()
    }
    await expect(page.getByText(/The graph stays flexible\./)).toBeVisible()
    const securityHeading = page.getByRole('heading', {
      level: 2,
      name: 'Ready for your security review',
      exact: true
    })
    await expect(securityHeading).toBeVisible()
    const securitySection = page
      .locator('section')
      .filter({ has: securityHeading })
    await expect(securitySection.getByRole('heading', { level: 3 })).toHaveText(
      [
        'Workflows stay local',
        'Private models and nodes',
        'Identity and BYOK',
        'Audit requirements'
      ]
    )
    await expect(
      securitySection.getByRole('link', { name: 'VIEW TRUST CENTER' })
    ).toHaveAttribute('href', /app\.vanta\.com\/comfy\.org\/trust/)
    await expect(
      securitySection.getByRole('link', { name: 'REQUEST DEMO' })
    ).toHaveAttribute('href', '/contact/')
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'Builder vs. Managed Builds'
      })
    ).toBeVisible()
    await expect(
      page.getByText(
        /Builder is self-serve for packaging and testing your own environment\./
      )
    ).toBeVisible()
    for (const feature of [
      'Custom nodes packaging',
      'Team sharing',
      'Governance',
      'Python dependency auto-resolution'
    ]) {
      await expect(
        page.getByRole('rowheader', { name: feature, exact: true })
      ).toBeVisible()
    }
    await expect(
      page.getByRole('columnheader', { name: 'MANAGED BUILDS' })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'Built with studios in the room'
      })
    ).toBeVisible()
    for (const industry of [
      'VFX & Animation',
      'Advertising & Creative Studios',
      'Gaming',
      'eCommerce & Fashion'
    ]) {
      await expect(
        page.getByRole('button', { name: industry, exact: true })
      ).toBeVisible()
    }
    await expect(
      page.getByRole('link', { name: 'EXPLORE WORKFLOWS' })
    ).toHaveAttribute('href', 'https://comfy.org/workflows/')
    await expect(
      page.getByText(/For teams that need ComfyUI to move between people/)
    ).toHaveCount(0)
    await expect(
      page.getByText(/dedicated GPU capacity, priority queueing/)
    ).toBeVisible()
  })
})

test.describe('Managed Builds — mobile @mobile', () => {
  test('comparison table scrolls in its container without page overflow', async ({
    page
  }) => {
    await page.goto('/enterprise/managed-builds')

    const table = page.getByRole('table')
    await table.scrollIntoViewIfNeeded()
    await expect(table).toBeVisible()
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              document.documentElement.scrollWidth >
              document.documentElement.clientWidth
          ),
        { message: 'page has horizontal overflow', timeout: 5_000 }
      )
      .toBe(false)
  })
})
