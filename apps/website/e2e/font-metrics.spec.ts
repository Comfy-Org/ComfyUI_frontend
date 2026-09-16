import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

// Rows that put an icon, a count or a control beside an uppercase word centre
// the boxes, not the ink. So a face whose caps sit high inside their line box
// misaligns every one of those rows at once, and no component can fix it.
const SIZE = 100

test('PP Formula centres its caps inside the line box', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)

  const face = await page.evaluate((size) => {
    const context = document.createElement('canvas').getContext('2d')
    if (!context) throw new Error('no canvas context')
    context.font = `${size}px "PP Formula"`
    const caps = context.measureText('H')
    return {
      ascent: caps.fontBoundingBoxAscent,
      descent: caps.fontBoundingBoxDescent,
      capHeight: caps.actualBoundingBoxAscent
    }
  }, SIZE)

  const aboveTheCaps = face.ascent - face.capHeight
  expect(Math.abs(aboveTheCaps - face.descent)).toBeLessThanOrEqual(SIZE / 100)
})
