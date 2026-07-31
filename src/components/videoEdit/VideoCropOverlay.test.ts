/* eslint-disable testing-library/prefer-user-event -- crop dragging needs low-level pointer events */
import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { Bounds } from '@/renderer/core/layout/types'

import VideoCropOverlay from './VideoCropOverlay.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      videoEdit: {
        adjustCrop: 'Adjust crop region'
      }
    }
  }
})

function renderOverlay({
  bounds = { x: 100, y: 100, width: 200, height: 200 },
  disabled = false,
  lockedRatio = null as number | null
} = {}) {
  const model = ref<Bounds>(bounds)
  render(VideoCropOverlay, {
    props: {
      modelValue: model.value,
      sourceWidth: 1000,
      sourceHeight: 1000,
      disabled,
      lockedRatio,
      'onUpdate:modelValue': (value: Bounds) => {
        model.value = value
      }
    },
    global: {
      plugins: [i18n]
    }
  })

  const root = screen.getByTestId('video-crop-overlay')
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    right: 100,
    bottom: 100,
    x: 0,
    y: 0,
    toJSON: () => ({})
  })

  return { model }
}

describe('VideoCropOverlay', () => {
  it('positions the crop box by source-relative percentages', () => {
    renderOverlay({ bounds: { x: 100, y: 200, width: 500, height: 250 } })

    const box = screen.getByLabelText('Adjust crop region')
    expect(box.style.left).toBe('10%')
    expect(box.style.top).toBe('20%')
    expect(box.style.width).toBe('50%')
    expect(box.style.height).toBe('25%')
  })

  it('renders eight resize handles', () => {
    renderOverlay()

    for (const dir of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
      expect(screen.getByTestId(`crop-handle-${dir}`)).toBeTruthy()
    }
  })

  it('moves the crop box by dragging it', async () => {
    const { model } = renderOverlay()

    const box = screen.getByLabelText('Adjust crop region')
    box.setPointerCapture = vi.fn()

    await fireEvent.pointerDown(box, {
      clientX: 0,
      clientY: 0,
      button: 0,
      pointerId: 1
    })
    await fireEvent.pointerMove(box, {
      clientX: 5,
      clientY: 7,
      pointerId: 1
    })
    await fireEvent.pointerUp(box, { pointerId: 1 })

    expect(model.value).toEqual({ x: 150, y: 170, width: 200, height: 200 })
  })

  it('resizes the crop box from a corner handle', async () => {
    const { model } = renderOverlay()

    const handle = screen.getByTestId('crop-handle-se')
    handle.setPointerCapture = vi.fn()

    await fireEvent.pointerDown(handle, {
      clientX: 0,
      clientY: 0,
      button: 0,
      pointerId: 1
    })
    await fireEvent.pointerMove(handle, {
      clientX: 10,
      clientY: 5,
      pointerId: 1
    })
    await fireEvent.pointerUp(handle, { pointerId: 1 })

    expect(model.value).toEqual({ x: 100, y: 100, width: 300, height: 250 })
  })

  it('does not react to drags while disabled', async () => {
    const { model } = renderOverlay({ disabled: true })

    const box = screen.getByLabelText('Adjust crop region')
    box.setPointerCapture = vi.fn()

    await fireEvent.pointerDown(box, {
      clientX: 0,
      clientY: 0,
      button: 0,
      pointerId: 1
    })
    await fireEvent.pointerMove(box, { clientX: 5, clientY: 5, pointerId: 1 })

    expect(model.value).toEqual({ x: 100, y: 100, width: 200, height: 200 })
  })
})
