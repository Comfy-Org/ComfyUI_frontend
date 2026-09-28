import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

// `font-display: optional` gives a face one short block period and then drops
// it for the rest of the page load. An unpreloaded face therefore renders as
// the fallback whenever the network is slow — silently, and for everyone on
// that load. It reached a committed visual baseline once: the pricing headline
// and price, the only two elements on that page in the unpreloaded Light face,
// were captured in the fallback while every preloaded weight matched exactly.
const PAGES = ['/', '/pricing', '/download', '/about', '/customers']

test('every PP Formula face rendered above the fold is preloaded', async ({
  page
}) => {
  const missing: string[] = []

  for (const path of PAGES) {
    await page.goto(path)
    await page.evaluate(() => document.fonts.ready)

    const gaps = await page.evaluate(() => {
      const preloaded = new Set(
        [...document.querySelectorAll('link[rel="preload"][as="font"]')].map(
          (link) =>
            new URL(link.getAttribute('href') ?? '', location.href).pathname
        )
      )

      const faces = [...document.styleSheets]
        .flatMap((sheet) => {
          try {
            return [...sheet.cssRules]
          } catch {
            return []
          }
        })
        .filter(
          (rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule
        )
        .map((rule) => ({
          family: rule.style
            .getPropertyValue('font-family')
            .replaceAll(/['"]/g, ''),
          weight: rule.style.getPropertyValue('font-weight'),
          file: /url\(["']?([^"')]+)/.exec(
            rule.style.getPropertyValue('src')
          )?.[1]
        }))
        .filter((face) => face.family.startsWith('PP Formula'))

      const rendered = new Set<string>()
      for (const element of document.querySelectorAll('body *')) {
        const style = getComputedStyle(element)
        const family = style.fontFamily.split(',')[0].replaceAll(/['"]/g, '')
        if (!family.startsWith('PP Formula')) continue

        const box = element.getBoundingClientRect()
        if (box.width === 0 || box.height === 0) continue
        if (box.top >= window.innerHeight) continue

        const carriesText = [...element.childNodes].some(
          (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
        )
        if (!carriesText) continue

        rendered.add(`${family}|${style.fontWeight}`)
      }

      return [...rendered]
        .map((key) => {
          const [family, weight] = key.split('|')
          // The browser picks the nearest declared weight, so resolve to the
          // file that actually serves this text rather than the weight asked
          // for: 800 is served by the Bold face until an Extrabold exists.
          const candidates = faces.filter((face) => face.family === family)
          if (candidates.length === 0) return null
          const nearest = candidates.reduce((best, face) =>
            Math.abs(Number(face.weight) - Number(weight)) <
            Math.abs(Number(best.weight) - Number(weight))
              ? face
              : best
          )
          return nearest.file && !preloaded.has(nearest.file)
            ? `${family} ${weight} → ${nearest.file}`
            : null
        })
        .filter((gap): gap is string => gap !== null)
    })

    missing.push(...gaps.map((gap) => `${path}: ${gap}`))
  }

  expect([...new Set(missing)]).toEqual([])
})
