import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('canonical redirects', () => {
  const enterpriseCases = [
    {
      source: '/cloud/enterprise',
      destination: '/enterprise/',
      heading: /Govern ComfyUI across\s+every team and runtime\./
    },
    {
      source: '/zh-CN/cloud/enterprise',
      destination: '/zh-CN/enterprise/',
      heading: /治理每个团队、每个运行环境中的 ComfyUI。/
    }
  ] as const

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

  test('builds each model page at /hub/models and points its old address there', () => {
    const canonical =
      'rel="canonical" href="https://comfy.org/hub/models/flux-2-max-text-to-image/"'
    for (const path of [
      'hub/models/flux-2-max-text-to-image',
      'models/bfl--flux-2-max--generate-images'
    ]) {
      expect(readFileSync(`dist/${path}/index.html`, 'utf8')).toContain(
        canonical
      )
    }
    expect(readFileSync('dist/models/index.html', 'utf8')).toContain(
      'rel="canonical" href="https://comfy.org/hub/models/"'
    )
  })

  test('builds the former Enterprise routes with the canonical destination', () => {
    for (const { source, destination } of enterpriseCases) {
      const redirectPage = readFileSync(`dist${source}/index.html`, 'utf8')

      expect(redirectPage).toContain(`url=${destination}`)
      expect(redirectPage).toContain(
        `rel="canonical" href="https://comfy.org${destination}"`
      )
    }
  })

  test('navigates the former Enterprise routes to the canonical page', async ({
    page
  }) => {
    // Astro preview serves static redirects as refresh documents. Vercel turns
    // the matching vercel.json rules into permanent HTTP redirects, which is
    // validated separately in src/config/redirects.test.ts.
    for (const { source, destination, heading } of enterpriseCases) {
      await page.goto(source)
      await expect(page).toHaveURL((url) => url.pathname === destination)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading)
    }
  })
})
