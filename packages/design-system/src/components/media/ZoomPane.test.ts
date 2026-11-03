import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'

import ZoomPane from './ZoomPane.vue'

type Transform = { scale: number; x: number; y: number }

function renderPane() {
  render(ZoomPane, {
    attrs: { 'data-testid': 'zoom-pane' },
    slots: {
      default: (slotProps: { style: { transform: string } }) =>
        h('img', { alt: 'output', src: '/output.png', ...slotProps })
    }
  })
  return screen.getByRole('img', { name: 'output' })
}

function readTransform(image: HTMLElement): Transform {
  const [scale, , , , x, y] = image.style.transform
    .slice('matrix('.length, -1)
    .split(',')
    .map(Number)
  return { scale, x, y }
}

async function touch(
  target: HTMLElement,
  type: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'lostPointerCapture',
  pointerId: number,
  clientX: number,
  clientY = 0
) {
  await fireEvent[type](target, {
    pointerId,
    pointerType: 'touch',
    button: 0,
    clientX,
    clientY
  })
}

async function pinch(target: HTMLElement, from: number, to: number) {
  await touch(target, 'pointerDown', 1, -from)
  await touch(target, 'pointerDown', 2, from)
  await touch(target, 'pointerMove', 1, -to)
  await touch(target, 'pointerMove', 2, to)
}

describe(ZoomPane, () => {
  it('zooms in when two touches spread apart', async () => {
    const image = renderPane()
    const before = readTransform(image)

    await pinch(image, 50, 100)

    expect(readTransform(image).scale).toBeGreaterThan(before.scale)
  })

  it('keeps the content under an off-center pinch midpoint in place', async () => {
    const image = renderPane()
    const before = readTransform(image)

    await touch(image, 'pointerDown', 1, 50)
    await touch(image, 'pointerDown', 2, 150)
    await touch(image, 'pointerMove', 1, 0)
    await touch(image, 'pointerMove', 2, 200)

    const after = readTransform(image)
    expect(after.scale / before.scale).toBeCloseTo(2)
    expect(after.x).toBeCloseTo(-100)
    expect(after.y).toBeCloseTo(0)
  })

  it('zooms out when two touches pinch together', async () => {
    const image = renderPane()
    const before = readTransform(image)

    await pinch(image, 100, 50)

    expect(readTransform(image).scale).toBeLessThan(before.scale)
  })

  it('keeps responding to pinches after both touches meet', async () => {
    const image = renderPane()
    await touch(image, 'pointerDown', 1, -50)
    await touch(image, 'pointerDown', 2, 50)
    await touch(image, 'pointerMove', 1, 50)
    await touch(image, 'pointerUp', 1, 50)
    await touch(image, 'pointerUp', 2, 50)
    const collapsed = readTransform(image)

    await pinch(image, 50, 100)

    expect(collapsed.scale).toBeGreaterThan(0)
    expect(readTransform(image).scale).toBeGreaterThan(collapsed.scale)
  })

  it('pans with the remaining touch after one finger lifts mid-pinch', async () => {
    const image = renderPane()
    await pinch(image, 50, 100)
    await touch(image, 'pointerUp', 2, 100)
    const afterPinch = readTransform(image)

    await touch(image, 'pointerMove', 1, -80, 30)

    expect(readTransform(image)).toEqual({
      scale: afterPinch.scale,
      x: afterPinch.x + 20,
      y: afterPinch.y + 30
    })
  })

  it('pans instead of pinching once a touch loses pointer capture', async () => {
    const image = renderPane()
    const before = readTransform(image)

    await touch(image, 'pointerDown', 1, 10, 10)
    await touch(image, 'pointerDown', 2, 60, 10)
    await touch(
      screen.getByTestId('zoom-pane'),
      'lostPointerCapture',
      2,
      60,
      10
    )
    await touch(image, 'pointerMove', 1, 40, 25)

    expect(readTransform(image)).toEqual({
      scale: before.scale,
      x: before.x + 30,
      y: before.y + 15
    })
  })

  it('keeps pinching when a slotted child loses its implicit capture', async () => {
    const image = renderPane()
    const before = readTransform(image)

    await touch(image, 'pointerDown', 1, -50)
    await touch(image, 'pointerDown', 2, 50)
    await touch(image, 'lostPointerCapture', 2, 50)
    await touch(image, 'pointerMove', 1, -100)
    await touch(image, 'pointerMove', 2, 100)

    expect(readTransform(image).scale).toBeGreaterThan(before.scale)
  })

  it('pans by the distance a single pointer drags', async () => {
    const image = renderPane()
    const before = readTransform(image)

    await touch(image, 'pointerDown', 1, 10, 10)
    await touch(image, 'pointerMove', 1, 40, 25)
    await touch(image, 'pointerUp', 1, 40, 25)
    await touch(image, 'pointerMove', 1, 90, 90)

    expect(readTransform(image)).toEqual({
      scale: before.scale,
      x: before.x + 30,
      y: before.y + 15
    })
  })

  it('zooms in on wheel scroll up', async () => {
    const image = renderPane()
    const before = readTransform(image)

    await fireEvent.wheel(image, { deltaY: -100 })

    expect(readTransform(image).scale).toBeGreaterThan(before.scale)
  })
})
