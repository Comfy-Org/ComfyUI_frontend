import { readFileSync } from 'node:fs'
import { appendFile, copyFile, mkdir } from 'node:fs/promises'

import { expect } from '@playwright/test'

import { workshopModelAvailabilitySchema } from '../src/config/workshop-model-availability-schema'
import { test } from './fixtures/modelsAccount'

const scenarios = [
  {
    name: 'Base64 input',
    models: [
      'vertexai--gemini-nano-banana-2--edit-images',
      'vertexai--gemini-3-pro-image--edit-images'
    ],
    field: 'images',
    inputField: 'images',
    result: {
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
                }
              }
            ]
          }
        }
      ]
    }
  },
  {
    name: 'URL upload input',
    models: ['wavespeed--seedvr2-image--edit-images'],
    field: 'image',
    inputField: 'image-upload',
    result: { output: ['https://storage.example/output.png'] }
  }
]
const availability = workshopModelAvailabilitySchema.parse(
  JSON.parse(
    readFileSync(
      new URL('../src/data/workshop-model-availability.json', import.meta.url),
      'utf8'
    )
  )
)
for (const { name, models, field, inputField, result } of scenarios) {
  const enabledModel = models.find((slug) => !availability[slug]?.disabled)

  test(
    enabledModel
      ? `${name}: an unreadable source file asks for reselection before a generation can run`
      : `${name}: file-read browser targets have been intentionally withheld`,
    async ({ context, page, modelsAccount }, testInfo) => {
      if (!enabledModel) {
        for (const slug of models) {
          const response = await page.goto(`/models/${slug}/`)
          expect(response?.status()).toBe(404)
        }
        return
      }
      const submitted: string[] = []
      let reselected = false
      const requestId = 'f0b55482-d90f-4c9f-8fda-351ece95aaee'
      await context.route('**/customers/storage', (route) =>
        route.fulfill({
          json: {
            upload_url: 'https://storage.example/upload',
            download_url: 'https://storage.example/input.png'
          }
        })
      )
      await context.route('https://storage.example/upload', (route) =>
        reselected ? route.fulfill({ status: 200 }) : route.abort('failed')
      )
      await context.route('https://storage.example/*.png', (route) =>
        route.fulfill({ path: 'e2e/assets/placeholder-1x1.webp' })
      )
      await context.route('**/v2/models/*/*/requests**', (route) => {
        if (route.request().method() === 'POST') {
          submitted.push(route.request().url())
          return route.fulfill({
            status: 201,
            json: { request_id: requestId, status: 'IN_QUEUE' }
          })
        }
        return route.fulfill({ json: result })
      })
      await page.goto('/login/')
      await page.getByRole('button', { name: 'Use email instead' }).click()
      await page.getByLabel('Email').fill(modelsAccount.email)
      await page
        .getByLabel('Password', { exact: true })
        .fill(modelsAccount.password)
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      await expect(page).toHaveURL('/')
      await page.goto(`/models/${enabledModel}/`)
      await expect(page.getByTestId('run-button')).toBeVisible()
      const source = page.getByTestId(`field-group-${field}`)
      for (const remove of await source
        .getByRole('button', { name: /^Remove / })
        .all())
        await remove.click()
      const input = source.getByTestId(`field-${inputField}`)
      await expect(input).toBeEnabled()

      await mkdir(testInfo.outputDir, { recursive: true })
      const filePath = testInfo.outputPath('source.webp')
      await copyFile('e2e/assets/placeholder-1x1.webp', filePath)
      const cdp = await context.newCDPSession(page)
      const document = await cdp.send('DOM.getDocument')
      const { nodeId } = await cdp.send('DOM.querySelector', {
        nodeId: document.root.nodeId,
        selector: `#field-${inputField}`
      })
      await cdp.send('DOM.setFileInputFiles', { nodeId, files: [filePath] })
      await expect(
        source.getByRole('button', { name: 'Replace source.webp' })
      ).toBeVisible()
      await appendFile(filePath, 'changed after selection')
      await page.getByTestId('run-button').click()
      await expect(page.getByTestId('playground-output')).toHaveAttribute(
        'data-state',
        'failed'
      )
      await testInfo.attach('file-read-error', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png'
      })
      await expect(input).toHaveAttribute('aria-invalid', 'true')
      await expect(page.getByTestId(`error-${field}`)).toHaveText(
        'This file can no longer be read. Select it again.'
      )
      await expect(page.getByTestId('playground-output')).toContainText(
        'The model has not run.'
      )
      await expect(
        page.getByRole('button', { name: 'Try again', exact: true })
      ).toHaveCount(0)
      expect(submitted).toEqual([])

      reselected = true
      await source.getByRole('button', { name: 'Remove source.webp' }).click()
      await cdp.send('DOM.setFileInputFiles', { nodeId, files: [filePath] })
      await expect(input).toHaveAttribute('aria-invalid', 'false')
      await page.getByTestId('run-button').click()
      await expect(page.getByTestId('playground-output')).toHaveAttribute(
        'data-state',
        'succeeded'
      )
      await expect(
        page
          .getByTestId('playground-output')
          .getByRole('img', { name: 'Output', exact: true })
      ).toHaveJSProperty('naturalWidth', 1)
      expect(submitted).toHaveLength(1)
    }
  )
}
