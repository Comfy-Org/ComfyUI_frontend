import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('canonical redirects', () => {
  test('builds the untranslated terms redirect with its canonical URL', () => {
    const redirectPage = readFileSync(
      'dist/zh-CN/terms-of-service/index.html',
      'utf8'
    )

    expect(redirectPage).toContain('url=/terms-of-service/')
    expect(redirectPage).toContain(
      'rel="canonical" href="https://comfy.org/terms-of-service/"'
    )
  })

  test('builds a model alias redirect with its canonical URL', () => {
    const redirectPage = readFileSync(
      'dist/p/supported-models/t5xxl-fp8-e4m3fn-scaled/index.html',
      'utf8'
    )

    expect(redirectPage).toContain('url=/p/supported-models/t5xxl-fp16/')
    expect(redirectPage).toContain(
      'rel="canonical" href="https://comfy.org/p/supported-models/t5xxl-fp16/"'
    )
  })

  test('builds the former Enterprise routes with the canonical destination', () => {
    for (const path of [
      'dist/cloud/enterprise/index.html',
      'dist/zh-CN/cloud/enterprise/index.html'
    ]) {
      const redirectPage = readFileSync(path, 'utf8')

      expect(redirectPage).toContain('url=/enterprise/')
      expect(redirectPage).toContain(
        'rel="canonical" href="https://comfy.org/enterprise/"'
      )
    }
  })

  test('navigates the former Enterprise routes to the canonical page', async ({
    page
  }) => {
    // Astro preview serves static redirects as refresh documents. Vercel turns
    // the matching vercel.json rules into permanent HTTP redirects, which is
    // validated separately in src/config/redirects.test.ts.
    for (const path of ['/cloud/enterprise', '/zh-CN/cloud/enterprise']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/enterprise\/$/)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        /Govern ComfyUI across\s+every team and runtime\./
      )
    }
  })

  test('navigates English-only and legacy localized routes to canonical destinations', async ({
    page
  }) => {
    const redirects = [
      {
        source: '/zh-CN/p/supported-models',
        destination: /\/p\/supported-models\/$/
      },
      {
        source: '/zh-CN/p/supported-models/grok-imagine',
        destination: /\/p\/supported-models\/grok-imagine\/$/
      },
      {
        source: '/zh-CN/platform/serverless-animation',
        destination: /\/platform\/serverless-animation\/$/
      },
      {
        source: '/zh-CN/pixal3d-trellis2',
        destination: /\/pixal3d-trellis2\/$/
      },
      { source: '/zh-CN/ja', destination: /\/zh-CN\/$/ }
    ]

    for (const { source, destination } of redirects) {
      await page.goto(source)
      await expect(page).toHaveURL(destination)
    }
  })
})
