import type { Locator } from '@playwright/test'

import type { Position } from '@e2e/fixtures/types'

type CanvasScanOrigin = 'top-left' | 'bottom-right'

export async function findEmptyCanvasPoint(
  canvas: Locator,
  scanOrigin: CanvasScanOrigin = 'top-left'
): Promise<Position> {
  return await canvas.evaluate((canvas, scanOrigin) => {
    const bounds = canvas.getBoundingClientRect()
    const xCoordinates: number[] = []
    const yCoordinates: number[] = []

    for (let x = bounds.left + 100; x < bounds.right - 100; x += 50) {
      xCoordinates.push(x)
    }
    for (let y = bounds.top + 100; y < bounds.bottom - 100; y += 50) {
      yCoordinates.push(y)
    }

    const xs =
      scanOrigin === 'bottom-right' ? xCoordinates.toReversed() : xCoordinates
    const ys =
      scanOrigin === 'bottom-right' ? yCoordinates.toReversed() : yCoordinates

    for (const y of ys) {
      for (const x of xs) {
        if (!document.elementFromPoint(x, y)?.closest('[data-node-id]')) {
          return { x, y }
        }
      }
    }

    throw new Error('No empty canvas point found')
  }, scanOrigin)
}
