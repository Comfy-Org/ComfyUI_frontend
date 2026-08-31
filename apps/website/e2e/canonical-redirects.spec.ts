import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

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
})
