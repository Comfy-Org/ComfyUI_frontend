import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

// Rows that put an icon, a count or a control beside an uppercase word centre
// the boxes, not the ink. So a face whose caps sit high inside their line box
// misaligns every one of those rows at once, and no component can fix it. The
// faces are measured from their own @font-face rules rather than from the page,
// because `font-display: optional` leaves the weights this page never renders
// unusable for measurement.
const SIZE = 1000

test('every PP Formula face centres its caps inside the line box', async ({
  page
}) => {
  await page.goto('/')
  await expect(page.locator('html')).not.toHaveClass(
    /(?:^|\s)ppformula-metric-fallback(?:\s|$)/
  )

  const faces = await page.evaluate(async (size) => {
    const rulesOf = (sheet: CSSStyleSheet) => {
      try {
        return [...sheet.cssRules]
      } catch {
        return []
      }
    }

    const declarations = [...document.styleSheets]
      .flatMap(rulesOf)
      .filter(
        (rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule
      )
      .map((rule) => ({
        family: rule.style
          .getPropertyValue('font-family')
          .replaceAll(/['"]/g, ''),
        weight: rule.style.getPropertyValue('font-weight'),
        source: rule.style.getPropertyValue('src'),
        ascentOverride: rule.style.getPropertyValue('ascent-override'),
        descentOverride: rule.style.getPropertyValue('descent-override')
      }))
      .filter((declaration) => declaration.family.startsWith('PP Formula'))

    return Promise.all(
      declarations.map(async (declaration, index) => {
        const url = /url\(["']?([^"')]+)/.exec(declaration.source)?.[1]
        if (!url) {
          throw new Error(`no source for ${declaration.family}`)
        }

        const probe = `probe-${index}`
        document.fonts.add(
          await new FontFace(probe, `url("${url}")`, {
            ascentOverride: declaration.ascentOverride,
            descentOverride: declaration.descentOverride
          }).load()
        )

        const context = document.createElement('canvas').getContext('2d')
        if (!context) throw new Error('no canvas context')
        context.font = `${size}px "${probe}"`
        const caps = context.measureText('H')
        return {
          family: declaration.family,
          name: `${declaration.family} ${declaration.weight}`,
          ascent: caps.fontBoundingBoxAscent,
          descent: caps.fontBoundingBoxDescent,
          capHeight: caps.actualBoundingBoxAscent
        }
      })
    )
  }, SIZE)

  expect([...new Set(faces.map((face) => face.family))].sort()).toEqual([
    'PP Formula',
    'PP Formula Narrow'
  ])

  for (const face of faces) {
    const aboveTheCaps = face.ascent - face.capHeight
    expect(
      Math.abs(aboveTheCaps - face.descent),
      face.name
    ).toBeLessThanOrEqual(SIZE / 100)
  }
})

test('keeps the component fallback when metric overrides are unsupported', async ({
  page
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(FontFace.prototype, 'ascentOverride', {
      configurable: true,
      get: () => ''
    })
  })
  await page.goto('/')

  await expect(page.locator('html')).toHaveClass(
    /(?:^|\s)ppformula-metric-fallback(?:\s|$)/
  )
  const marker = page.locator('.ppformula-text-center').first()
  await expect(marker).toBeVisible()
  expect(
    await marker.evaluate((element) => getComputedStyle(element).top)
  ).not.toBe('auto')
})
