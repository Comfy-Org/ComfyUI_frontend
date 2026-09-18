import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect } from '@playwright/test'

import { workshopContractRecordSchema } from '../../src/config/workshop-contract'
import { validateWorkshopInput } from '../../src/config/workshop-json-schema'
import { MODEL_PATH, test as base } from './modelsAccount'

const contracts = workshopContractRecordSchema
  .array()
  .parse(
    JSON.parse(
      readFileSync(
        new URL(
          '../../src/content/workshop-router-contracts.json',
          import.meta.url
        ),
        'utf8'
      )
    )
  )

export const test = base.extend<{
  generationProgress: { complete: () => void; requested: Promise<void> }
}>({
  generationProgress: async ({ page, context, modelsAccount }, use) => {
    const completion = Promise.withResolvers<void>()
    const requested = Promise.withResolvers<void>()
    const url = 'https://output.example/generation-progress.webp'
    const response = {
      id: 'generation-progress-e2e',
      status: 'Ready',
      result: { sample: url }
    }
    const contract = contracts.find(
      ({ catalogId }) => catalogId === 'bfl/flux-2-max'
    )
    if (
      contract?.output.format !== 'json' ||
      !validateWorkshopInput(response, contract.output.schema)
    )
      throw new Error(
        'The progress fixture must satisfy the BFL output contract'
      )
    await context.route(url, (route) =>
      route.fulfill({
        contentType: 'image/webp',
        path: fileURLToPath(
          new URL('../assets/placeholder-1x1.webp', import.meta.url)
        )
      })
    )
    await context.route('**/v2/models/bfl/flux-2-max', async (route) => {
      requested.resolve()
      await completion.promise
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(response)
      })
    })
    await page.goto('/login/')
    await page.getByRole('button', { name: 'Use email instead' }).click()
    await page.getByLabel('Email').fill(modelsAccount.email)
    await page
      .getByLabel('Password', { exact: true })
      .fill(modelsAccount.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.waitForURL('/')
    await page.clock.install()
    await page.goto(MODEL_PATH)
    await expect(page.getByTestId('run-button')).toBeEnabled()
    await page.clock.pauseAt(new Date(Date.now() + 1_000))
    try {
      await use({
        complete: () => completion.resolve(),
        requested: requested.promise
      })
    } finally {
      completion.resolve()
    }
  }
})
