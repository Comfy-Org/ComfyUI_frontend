import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { test } from './fixtures/modelsAccount'
import { workshopModelAvailabilitySchema } from '../src/config/workshop-model-availability-schema'

const availability = workshopModelAvailabilitySchema.parse(
  JSON.parse(
    readFileSync(
      new URL('../src/data/workshop-model-availability.json', import.meta.url),
      'utf8'
    )
  )
)

async function openModel(page: Page, slug: string): Promise<boolean> {
  const response = await page.goto(`/models/${slug}/`)
  if (availability[slug]?.disabled) {
    expect(response?.status()).toBe(404)
    return false
  }
  await expect(page.getByTestId('run-button')).toBeEnabled()
  return true
}

test.beforeEach(async ({ page, modelsAccount }) => {
  await page.goto('/login/')
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await page.getByLabel('Email').fill(modelsAccount.email)
  await page
    .getByLabel('Password', { exact: true })
    .fill(modelsAccount.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/')
})

test('Veo requires the first frame before preparing a generation', async ({
  page,
  context
}, testInfo) => {
  const submitted: string[] = []
  await context.route('**/v2/models/**', (route) => {
    submitted.push(route.request().url())
    return route.abort('blockedbyclient')
  })
  if (
    !(await openModel(page, 'vertexai--veo-3-first-last-frame--animate-images'))
  )
    return
  const first = page.getByTestId('field-group-first_frame')
  await expect(first.getByTestId('field-first_frame')).toBeEnabled()
  await expect(first.getByRole('button', { name: /^Remove / })).toBeVisible()
  for (const remove of await first
    .getByRole('button', { name: /^Remove / })
    .all())
    await remove.click()
  await expect(page.getByTestId('field-group-reference_images')).toHaveCount(0)
  await page.getByTestId('run-button').click()
  await expect(page.getByTestId('error-first_frame')).toHaveText(
    'This field is required'
  )
  expect(submitted).toEqual([])
  await testInfo.attach('veo-validation', {
    body: await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath('veo-validation.png')
    }),
    contentType: 'image/png'
  })
})

test('Grok reference offers only durations up to ten seconds', async ({
  page
}) => {
  if (
    !(await openModel(
      page,
      'xai--grok-imagine-video-reference--animate-images'
    ))
  )
    return
  const duration = page.getByTestId('field-duration')
  await expect(duration.getByRole('option')).toHaveText(
    Array.from({ length: 10 }, (_, index) => `${index + 1} seconds`)
  )
  await expect(duration.locator('option:checked')).toHaveText('8 seconds')
})

test('Seedream rejects incompatible layer settings and clears the error when corrected', async ({
  page,
  context
}, testInfo) => {
  const submitted: string[] = []
  await context.route('**/v2/models/**', (route) => {
    submitted.push(route.request().url())
    return route.abort('blockedbyclient')
  })
  if (!(await openModel(page, 'byteplus--seedream-5-pro--edit-images'))) return
  await page
    .getByTestId('playground-advanced')
    .getByText('Advanced settings', { exact: true })
    .click()
  await page.getByTestId('field-layer_decomposition').check()
  await page.getByTestId('field-size').selectOption({ label: '1024x1024' })
  await page.getByTestId('run-button').click()
  await expect(page.getByTestId('error-size')).toContainText(
    'Separate layers supports Auto, 1K, 1.5K or 2K.'
  )
  expect(submitted).toEqual([])
  await testInfo.attach('seedream-validation', {
    body: await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath('seedream-validation.png')
    }),
    contentType: 'image/png'
  })
  await page.getByTestId('field-layer_decomposition').uncheck()
  await expect(page.getByTestId('error-size')).toHaveCount(0)
})

test('Kling reads source duration before upload and runs after a shorter video is selected', async ({
  page,
  context
}, testInfo) => {
  const submitted: string[] = []
  const uploads: string[] = []
  await context.route('**/customers/storage', (route) => {
    uploads.push(route.request().url())
    return route.fulfill({
      json: {
        upload_url: 'https://storage.example/upload',
        download_url: 'https://storage.example/source.webm'
      }
    })
  })
  await context.route('https://storage.example/upload', (route) =>
    route.fulfill({ status: 200 })
  )
  await context.route('https://storage.example/*.webm', (route) =>
    route.fulfill({
      path: 'e2e/assets/placeholder.webm',
      contentType: 'video/webm'
    })
  )
  await context.route('**/v2/models/*/*/requests**', (route) => {
    if (route.request().method() === 'POST') {
      submitted.push(route.request().url())
      return route.fulfill({
        status: 201,
        json: {
          request_id: 'f0b55482-d90f-4c9f-8fda-351ece95aaee',
          status: 'IN_QUEUE'
        }
      })
    }
    return route.fulfill({
      json: {
        data: {
          task_status: 'succeed',
          task_result: {
            videos: [{ url: 'https://storage.example/output.webm' }]
          }
        }
      }
    })
  })
  if (!(await openModel(page, 'kling--omni-pro-edit-video--edit-videos')))
    return
  const source = page.getByTestId('field-group-video_url')
  await expect(source.getByTestId('field-video_url-upload')).toBeEnabled()
  for (const remove of await source
    .getByRole('button', { name: /^Remove / })
    .all())
    await remove.click()
  const input = page.getByTestId('field-video_url-upload')
  await input.setInputFiles('e2e/assets/validation-16s.mp4')
  await page.getByTestId('run-button').click()
  await expect(page.getByTestId('error-video_url')).toHaveText(
    'Use a video that is 15.5 seconds or shorter.'
  )
  expect(submitted).toEqual([])
  expect(uploads).toEqual([])
  await testInfo.attach('kling-validation', {
    body: await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath('kling-validation.png')
    }),
    contentType: 'image/png'
  })
  await source
    .getByRole('button', { name: 'Remove validation-16s.mp4' })
    .click()
  await input.setInputFiles('e2e/assets/placeholder.webm')
  await page.getByTestId('run-button').click()
  await expect(page.getByTestId('playground-output')).toHaveAttribute(
    'data-state',
    'succeeded'
  )
  expect(submitted).toHaveLength(1)
  expect(uploads).toHaveLength(1)
})
