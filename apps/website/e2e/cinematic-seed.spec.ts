import { expect } from '@playwright/test'
import { test } from './fixtures/modelsAccount'

for (const width of [1440, 390]) {
  test(`seed behavior survives reload and advances after a demo run at ${width}px`, async ({
    page
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/cinematic-studio?demo=success')
    const seed = page.getByRole('spinbutton', { name: 'Seed (optional)' })
    const behavior = page.getByRole('combobox', { name: 'After run' })
    await seed.fill('10')
    await behavior.selectOption('increment')
    await page
      .getByRole('textbox', { name: 'Scene', exact: true })
      .fill('A quiet lake')
    await page.getByTestId('cinematic-generate').click()
    await expect(
      page.getByRole('dialog', { name: 'Review your shot' })
    ).toContainText('10')
    await page
      .getByRole('dialog', { name: 'Review your shot' })
      .getByRole('button', { name: 'Generate shot', exact: true })
      .click()
    await expect(seed).toHaveValue('11')
    await page.reload()
    await expect(behavior).toHaveValue('increment')
    await expect(seed).toHaveValue('11')
    await page.getByRole('button', { name: 'Video', exact: true }).click()
    await expect(behavior).toHaveValue('random')
    await behavior.selectOption('fixed')
    await expect(seed).toHaveValue('0')
  })
}
