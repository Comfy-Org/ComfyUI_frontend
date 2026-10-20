import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'

test('CLI setup preserves the client across connections and closes with focus restored @smoke', async ({
  page
}) => {
  await page.goto('/cli/')
  const setup = page.locator('#setup')
  await waitForIsland(page, setup)
  const dialog = page.getByRole('dialog')
  const opener = setup.getByRole('button', { name: 'SET UP Codex' })
  await test.step('Open setup for Codex', async () => {
    await setup.getByRole('tab', { name: 'Codex', exact: true }).click()
    await opener.click()
    await expect(dialog).toHaveAccessibleName('Set up Codex')
    await expect(dialog.getByText(/comfy setup --where cloud/)).toBeVisible()
  })
  await test.step('Use the same client locally', async () => {
    await dialog.getByRole('button', { name: 'Local', exact: true }).click()
    await expect(
      dialog.getByRole('tab', { name: 'Codex', exact: true })
    ).toHaveAttribute('aria-selected', 'true')
    await expect(dialog.getByText(/comfy setup --where local/)).toBeVisible()
  })
  await test.step('Read manual setup', async () => {
    await dialog.getByRole('tab', { name: 'Manual', exact: true }).click()
    await expect(dialog).toHaveAccessibleName(
      'Set up Comfy CLI in your terminal'
    )
    await expect(
      dialog.getByText('pip install comfy-cli', { exact: true })
    ).toBeVisible()
    await expect(
      dialog.getByText('comfy setup --where local\ncomfy skills install', {
        exact: true
      })
    ).toBeVisible()
  })
  await test.step('Dismiss setup and restore focus', async () => {
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
  })
  await test.step('Restore focus when changing to a shell removes the manual opener', async () => {
    await setup.getByRole('button', { name: 'INSTALL MANUALLY' }).click()
    await dialog.getByRole('tab', { name: 'Terminal', exact: true }).click()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(
      setup.getByRole('button', { name: 'SET UP Terminal' })
    ).toBeFocused()
  })
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
