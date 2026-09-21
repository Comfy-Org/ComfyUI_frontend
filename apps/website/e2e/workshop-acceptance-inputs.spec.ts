import { copyFile, mkdir } from 'node:fs/promises'

import { expect } from '@playwright/test'

import { modelCases } from '../acceptance/cases'
import { useAdvancedInputs, useOwnInputs } from '../acceptance/fixtures'
import { signIn } from './fixtures/buyCredits'
import { test } from './fixtures/modelsAccount'

test.beforeEach(async ({ context, page, modelsAccount }, testInfo) => {
  await context.route(
    'https://media.comfy.org/website/workshop/heygen/starfish-tts/harbour-radio-signs-off.mp3',
    (route) => route.fulfill({ contentType: 'audio/mpeg', body: '' })
  )
  await mkdir(testInfo.outputDir, { recursive: true })
  await copyFile(
    '../../browser_tests/assets/test_upload_image.png',
    testInfo.outputPath('reference.png')
  )
  await copyFile(
    '../../browser_tests/assets/test_upload_image.png',
    testInfo.outputPath('last-frame.png')
  )
  await copyFile(
    '../../browser_tests/assets/plain_video.mp4',
    testInfo.outputPath('reference.mp4')
  )
  await context.route('**/customers/storage', (route) =>
    route.fulfill({
      json: {
        upload_url: 'https://storage.example/upload',
        download_url: 'https://storage.example/input'
      }
    })
  )
  await context.route('https://storage.example/upload', (route) =>
    route.fulfill({ status: 204 })
  )
  await context.route('**/v2/models/**', (route) =>
    route.fulfill({
      status: 503,
      headers: { 'X-Comfy-Error-Type': 'provider_error' },
      json: { error: 'Controlled offline provider boundary' }
    })
  )
  await signIn(page, modelsAccount)
})

for (const model of modelCases) {
  test(`${model.slug}: acceptance inputs reach the generation request`, async ({
    page
  }, testInfo) => {
    await page.goto(`/models/${model.slug}/`)
    await useOwnInputs(page, model, testInfo.outputDir)
    await useAdvancedInputs(page, model)
    const submitted = page.waitForRequest(
      (request) =>
        new URL(request.url()).pathname ===
          `/v2/models/${model.routerId}/requests` && request.method() === 'POST'
    )
    await page.getByTestId('run-button').click()
    const request = await submitted
    expect(request.postData()).toContain(JSON.stringify(model.prompt))
    expect(request.postDataJSON()).toHaveProperty(
      model.advancedField,
      Number(model.advancedValue)
    )
    await expect(page.getByTestId('playground-output')).toHaveAttribute(
      'data-state',
      'failed'
    )
  })
}
