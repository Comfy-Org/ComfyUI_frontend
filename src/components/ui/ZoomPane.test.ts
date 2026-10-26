import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'

import ZoomPane from './ZoomPane.vue'

it('zooms around the pointer and pans until the drag is cancelled', async () => {
  render({
    components: { ZoomPane },
    template: `
      <ZoomPane v-slot="{ style }" data-testid="pane">
        <div :style="style" data-testid="content">Preview</div>
      </ZoomPane>
    `
  })
  const pane = screen.getByTestId('pane')
  const content = screen.getByTestId('content')
  vi.spyOn(pane, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 200, 100)
  )
  vi.spyOn(pane, 'setPointerCapture').mockImplementation(() => {})
  const initial = content.style.transform

  await fireEvent(
    pane,
    Object.assign(new WheelEvent('wheel', { deltaY: -30 }), {
      clientX: 150,
      clientY: 50
    })
  )
  expect(content.style.transform).not.toBe(initial)
  expect(Number(content.style.transform.split(',')[4])).toBeCloseTo(-5)
  await fireEvent(
    pane,
    Object.assign(new WheelEvent('wheel', { deltaY: 30 }), {
      clientX: 150,
      clientY: 50
    })
  )
  expect(content.style.transform.split(',')[0]).toBe(initial.split(',')[0])

  await userEvent.pointer({ target: pane, keys: '[MouseLeft>]' })
  const movement = Object.defineProperties(new PointerEvent('pointermove'), {
    movementX: { value: 20 },
    movementY: { value: -10 }
  })
  await fireEvent(pane, movement)
  expect(Number(content.style.transform.split(',')[4])).toBeCloseTo(20)
  expect(content.style.transform).toContain(',-10)')
  await fireEvent.pointerCancel(pane)
  const stopped = content.style.transform
  await fireEvent(pane, movement)
  expect(content.style.transform).toBe(stopped)
})
