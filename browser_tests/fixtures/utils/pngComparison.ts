import { createRequire } from 'node:module'

import type {
  PageAssertionsToHaveScreenshotOptions,
  TestInfo
} from '@playwright/test'
import { expect } from '@playwright/test'

type ComparatorOptions = Pick<
  PageAssertionsToHaveScreenshotOptions,
  'threshold' | 'maxDiffPixels' | 'maxDiffPixelRatio'
>

type ImageComparator = (
  actual: Buffer,
  expected: Buffer,
  options?: ComparatorOptions
) => { errorMessage: string; diff?: Buffer } | null

function loadPngComparator(): ImageComparator {
  const fromTestRunner = createRequire(
    createRequire(import.meta.url).resolve('@playwright/test')
  )
  const fromPlaywright = createRequire(fromTestRunner.resolve('playwright'))
  const { utils } = fromPlaywright('playwright-core/lib/coreBundle') as {
    utils: { getComparator(mimeType: string): ImageComparator }
  }
  return utils.getComparator('image/png')
}

export async function expectPngsToMatch(
  testInfo: TestInfo,
  name: string,
  actual: Buffer,
  expected: Buffer,
  options?: ComparatorOptions
): Promise<void> {
  const result = loadPngComparator()(actual, expected, options)
  if (result?.diff) {
    const images = { actual, expected, diff: result.diff }
    for (const [suffix, body] of Object.entries(images))
      await testInfo.attach(`${name}-${suffix}.png`, {
        body,
        contentType: 'image/png'
      })
  }
  expect(result?.errorMessage, `${name} images differ`).toBeUndefined()
}
