import { expect } from '@playwright/test'

import { MODEL_PATH, test } from './fixtures/modelsAccount'

test('runs a default model without Safari static abort helpers', async ({
  context,
  page,
  modelsAccount
}) => {
  await context.addInitScript(() => {
    Object.defineProperty(AbortSignal, 'any', {
      configurable: true,
      value: undefined
    })
    Object.defineProperty(AbortSignal, 'timeout', {
      configurable: true,
      value: undefined
    })
  })

  const requestId = 'f0b55482-d90f-4c9f-8fda-351ece95aaee'
  const outputUrl = 'https://output.example/generated.webp'
  const requests: string[] = []
  await context.route('**/v2/models/bfl/flux-2-max/requests**', (route) => {
    requests.push(route.request().method())
    return route.fulfill(
      route.request().method() === 'POST'
        ? {
            status: 201,
            json: { request_id: requestId, status: 'IN_QUEUE' }
          }
        : {
            json: {
              id: 'generation',
              status: 'Ready',
              result: { sample: outputUrl }
            }
          }
    )
  })
  await context.route(outputUrl, (route) =>
    route.fulfill({ path: 'e2e/assets/placeholder-1x1.webp' })
  )

  await page.goto('/login/')
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await page.getByLabel('Email').fill(modelsAccount.email)
  await page
    .getByLabel('Password', { exact: true })
    .fill(modelsAccount.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/')

  await page.goto(MODEL_PATH)
  expect(
    await page.evaluate(() => [
      typeof AbortSignal.any,
      typeof AbortSignal.timeout
    ])
  ).toEqual(['undefined', 'undefined'])
  await expect(page.getByTestId('run-button')).toBeEnabled()
  await page.getByTestId('run-button').click()

  const output = page.getByTestId('playground-output')
  await expect(output).toHaveAttribute('data-state', 'succeeded')
  await expect(
    output.getByRole('img', { name: 'Output', exact: true })
  ).toHaveJSProperty('naturalWidth', 1)
  expect(requests).toEqual(['POST', 'GET'])
})
