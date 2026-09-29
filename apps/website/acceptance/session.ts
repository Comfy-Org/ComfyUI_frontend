import type { BrowserContext } from '@playwright/test'

import { modelCases } from './cases'
import { requiredSetting } from './settings'

export async function prepareSession(context: BrowserContext) {
  const page = await context.newPage()
  const path = `/models/${modelCases[0].slug}/`
  await page.goto(`/login/?returnTo=${encodeURIComponent(path)}`)
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await page.getByLabel('Email').fill(requiredSetting('WORKSHOP_ACCOUNT_EMAIL'))
  await page
    .getByLabel('Password', { exact: true })
    .fill(requiredSetting('WORKSHOP_ACCOUNT_PASSWORD'))
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page
    .getByTestId('run-button')
    .and(page.locator('[data-gate="ready"]'))
    .waitFor()
}
