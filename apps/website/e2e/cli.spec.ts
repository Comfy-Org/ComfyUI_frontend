import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'

test('CLI setup preserves the client across connections and closes with focus restored @smoke', async ({
  page
}) => {
  await page.goto('/cli/')
  const setup = page.locator('#setup')
  await waitForIsland(page, setup)
  await setup.getByRole('tab', { name: 'Codex', exact: true }).click()
  const opener = setup.getByRole('button', { name: 'SET UP Codex' })
  await opener.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toHaveAccessibleName('Set up Codex')
  await expect(dialog.getByText(/comfy setup --where cloud/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Local', exact: true }).click()
  await expect(
    dialog.getByRole('tab', { name: 'Codex', exact: true })
  ).toHaveAttribute('aria-selected', 'true')
  await expect(dialog.getByText(/comfy setup --where local/)).toBeVisible()
  await dialog.getByRole('tab', { name: 'Manual', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Set up Comfy CLI in your terminal' })
  ).toBeVisible()
  await expect(
    dialog.getByText('pip install comfy-cli', { exact: true })
  ).toBeVisible()
  await expect(
    dialog.getByText('comfy setup --where local\ncomfy skills install', {
      exact: true
    })
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(opener).toBeFocused()
})

test.describe('CLI reduced motion @mobile', () => {
  test.use({ reducedMotion: 'reduce' })

  test('shows both saved outputs without offering playback controls', async ({
    page
  }) => {
    await page.goto('/cli/')
    const session = page.getByTestId('native-cli-session')
    await waitForIsland(page, session)
    await expect(session.getByRole('group')).toHaveAccessibleName(
      'CLI session: final outputs shown with reduced motion.'
    )
    await expect(session.getByText('cat.png', { exact: true })).toBeVisible()
    await expect(
      session.getByText('f5308bc5_000.png', { exact: true })
    ).toBeVisible()
    await expect(session.getByRole('button')).toHaveCount(0)
  })
})
