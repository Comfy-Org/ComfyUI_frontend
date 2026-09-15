import type { Locator, Page } from '@playwright/test'

import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'

export async function expectDomTextGeometry(texts: Locator[]) {
  const geometry = await Promise.all(
    texts.map((text) =>
      text.evaluate((element) => {
        const range = document.createRange()
        range.selectNodeContents(element)
        const textBounds = range.getBoundingClientRect()
        const rowBounds = element.parentElement!.getBoundingClientRect()
        return {
          text: textBounds.toJSON(),
          row: rowBounds.toJSON()
        }
      })
    )
  )
  expectTextSeparated(geometry.map(({ text }) => text))
  for (const { text, row } of geometry) {
    expect(text.width).toBeGreaterThan(0)
    expect(text.left).toBeGreaterThanOrEqual(row.left)
    expect(text.right).toBeLessThanOrEqual(row.right)
    expect(text.top).toBeGreaterThanOrEqual(row.top)
    expect(text.bottom).toBeLessThanOrEqual(row.bottom)
  }
}

function expectTextSeparated(
  draws: Array<{ left: number; right: number; top: number; bottom: number }>
) {
  expect(
    draws.some((draw, index) =>
      draws
        .slice(index + 1)
        .some(
          (other) =>
            draw.left < other.right &&
            draw.right > other.left &&
            draw.top < other.bottom &&
            draw.bottom > other.top
        )
    ),
    'rendered label bounds must not overlap'
  ).toBe(false)
}

export async function captureCanvasTextGeometry(
  page: Page,
  expected: string[],
  forceOverlap = false
) {
  const captures = await page.evaluate(
    async ({ labels, forceOverlap }) => {
      const context = window.app!.canvas.canvas.getContext('2d')!
      const original = context.fillText
      let firstOrigin: DOMPoint | undefined
      const draws: Array<{
        text: string
        left: number
        right: number
        top: number
        bottom: number
      }> = []
      context.fillText = function (text, x, y, maxWidth) {
        const transform = this.getTransform()
        if (text === labels[1]) firstOrigin = transform.transformPoint({ x, y })
        if (forceOverlap && text === labels[2] && firstOrigin) {
          const moved = transform.inverse().transformPoint(firstOrigin)
          x = moved.x
          y = moved.y
        }
        if (labels.includes(text)) {
          const metrics = this.measureText(text)
          const corners = [
            [
              x - metrics.actualBoundingBoxLeft,
              y - metrics.actualBoundingBoxAscent
            ],
            [
              x + metrics.actualBoundingBoxRight,
              y - metrics.actualBoundingBoxAscent
            ],
            [
              x - metrics.actualBoundingBoxLeft,
              y + metrics.actualBoundingBoxDescent
            ],
            [
              x + metrics.actualBoundingBoxRight,
              y + metrics.actualBoundingBoxDescent
            ]
          ].map(([x, y]) => transform.transformPoint({ x, y }))
          draws.push({
            text,
            left: Math.min(...corners.map(({ x }) => x)),
            right: Math.max(...corners.map(({ x }) => x)),
            top: Math.min(...corners.map(({ y }) => y)),
            bottom: Math.max(...corners.map(({ y }) => y))
          })
        }
        if (maxWidth === undefined) original.call(this, text, x, y)
        else original.call(this, text, x, y, maxWidth)
      }
      try {
        window.app!.graph.setDirtyCanvas(true, true)
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve())
        )
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve())
        )
      } finally {
        context.fillText = original
        window.app!.graph.setDirtyCanvas(true, true)
      }
      return draws
    },
    { labels: expected, forceOverlap }
  )

  const draws = expected.flatMap((label) => {
    const capture = captures.find(({ text }) => text === label)
    return capture ? [capture] : []
  })
  for (const label of expected) {
    expect(
      draws.some(({ text }) => text === label),
      `${label} was drawn`
    ).toBe(true)
  }
  expectTextSeparated(draws)
}
