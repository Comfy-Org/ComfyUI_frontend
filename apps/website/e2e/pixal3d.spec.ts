import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test('3D examples update the input and downloadable result @smoke', async ({
  page
}) => {
  await page.route('https://media.comfy.org/**/*.glb', (route) => route.abort())
  await page.goto('/pixal3d-trellis2/')

  await test.step('Select a different example', async () => {
    const dragon = page.getByRole('button', { name: 'Use Dragon example' })
    await expect(
      page.getByRole('button', { name: 'Use Viking axe example' })
    ).toHaveAttribute('aria-pressed', 'true')
    await dragon.click()
    await expect(dragon).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByRole('link', { name: 'Download GLB' })
    ).toHaveAttribute(
      'href',
      'https://media.comfy.org/website/pixal3d-trellis2/dragon-hatchling-result.glb'
    )
    const input: unknown = JSON.parse(
      (await page.locator('#input-json').textContent()) ?? ''
    )
    expect(input).toMatchObject({
      workflow: 'pixal3d-trellis2',
      inputs: { image: 'dragon-hatchling-input.png', output_format: 'glb' }
    })
  })

  await test.step('Switch between result code and preview', async () => {
    await page.getByRole('button', { name: 'Code', exact: true }).click()
    await expect(page.locator('#result-json')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Download GLB' })).toBeHidden()
    await page.getByRole('button', { name: 'Preview', exact: true }).click()
    await expect(page.getByRole('link', { name: 'Download GLB' })).toBeVisible()
  })
})
