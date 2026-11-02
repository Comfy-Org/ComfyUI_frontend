import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'

import ZoomPane from './ZoomPane.vue'

type Transform = { scale: number; x: number; y: number }

function renderPane() {
  render(ZoomPane, {
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
  type: 'pointerDown' | 'pointerMove' | 'pointerUp',
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

  it('zooms out when two touches pinch together', async () => {
    const image = renderPane()
    const before = readTransform(image)

    await pinch(image, 100, 50)

    expect(readTransform(image).scale).toBeLessThan(before.scale)
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
