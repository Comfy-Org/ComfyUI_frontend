import type { Page } from '@playwright/test'

export async function waitForPpFormulaLight(page: Page) {
  const loadedFaces = await page.evaluate(async () => {
    const faces = await document.fonts.load('300 1em "PP Formula"')
    await document.fonts.ready
    return faces.length
  })

  if (loadedFaces === 0) throw new Error('PP Formula Light failed to load')
}

/** Loads every font face the page declares, so text below the fold is not laid out in a fallback font. */
export async function loadEveryFontFace(page: Page) {
  await page.evaluate(async () => {
    await Promise.allSettled([...document.fonts].map((face) => face.load()))
    await document.fonts.ready
  })
}
