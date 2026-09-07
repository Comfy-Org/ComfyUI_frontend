import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

test.describe('canonical redirects', () => {
  /**
   * This used to assert a redirect stub. It cannot be one any more.
   *
   * Chinese is served by Astro's i18n fallback rather than by its own page
   * files, and a fallback route and a redirect cannot both own the same URL —
   * the route wins, and the redirect is dropped from the build silently.
   *
   * The SEO contract is unchanged and is what is asserted instead: the page
   * canonicals to the English document, is noindex, and is absent from the
   * sitemap. A reader who lands here gets the terms rather than a bounce.
   */
  test('serves the untranslated terms at its canonical English document', () => {
    const page = readFileSync('dist/zh-CN/terms-of-service/index.html', 'utf8')

    expect(page).toContain(
      'rel="canonical" href="https://comfy.org/terms-of-service/"'
    )
    expect(page).toContain('content="noindex')
    expect(page).not.toContain('url=/terms-of-service/')

    const sitemap = readFileSync('dist/sitemap-0.xml', 'utf8')
    expect(sitemap).not.toContain('comfy.org/zh-CN/terms-of-service')
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
})
