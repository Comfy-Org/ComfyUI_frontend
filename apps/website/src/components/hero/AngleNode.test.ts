// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  FakeIntersectionObserver,
  stubIntersectionObserver
} from '../../test/fakeIntersectionObserver'
import type { CameraWidgetOptions } from './camera/types'
import AngleNode from './AngleNode.vue'

const widgets = vi.hoisted(() => ({
  instances: [] as {
    options: CameraWidgetOptions
    setState: ReturnType<typeof vi.fn>
    pause: ReturnType<typeof vi.fn>
    resume: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>
  }[]
}))

vi.mock('./camera/CameraWidget', () => ({
  CameraWidget: class {
    setState = vi.fn()
    pause = vi.fn()
    resume = vi.fn()
    dispose = vi.fn()
    constructor(readonly options: CameraWidgetOptions) {
      widgets.instances.push(this)
    }
  }
}))

async function renderAngleNode() {
  const utils = render(AngleNode, {
    props: { azimuth: 10, elevation: 5, zoom: 7 }
  })
  // The scene lazy-initializes when scrolled near and the thread goes idle.
  FakeIntersectionObserver.instances[0].intersect(true)
  await vi.advanceTimersByTimeAsync(250)
  return { ...utils, widget: widgets.instances.at(-1)! }
}

describe('AngleNode', () => {
  beforeEach(() => {
    widgets.instances = []
    stubIntersectionObserver()
  })

  it('creates the 3D scene only once it scrolls near the viewport', async () => {
    render(AngleNode)
    expect(widgets.instances).toHaveLength(0)

    FakeIntersectionObserver.instances[0].intersect(true)
    await vi.advanceTimersByTimeAsync(250)

    expect(widgets.instances).toHaveLength(1)
    expect(widgets.instances[0].options.initialState).toMatchObject({
      azimuth: 0,
      elevation: 0,
      distance: 5,
      imageUrl: '/hero/input.webp'
    })
  })

  it('seeds the widget from its models and mirrors widget drags back out', async () => {
    const { widget, emitted } = await renderAngleNode()

    expect(widget.options.initialState).toMatchObject({
      azimuth: 10,
      elevation: 5,
      distance: 7
    })

    widget.options.onStateChange?.({
      azimuth: 90,
      elevation: 20,
      distance: 3,
      imageUrl: null
    })

    expect(emitted('update:azimuth').at(-1)).toEqual([90])
    expect(emitted('update:elevation').at(-1)).toEqual([20])
    expect(emitted('update:zoom').at(-1)).toEqual([3])
    // A widget-originated change must not echo back into the widget.
    expect(widget.setState).not.toHaveBeenCalled()
  })

  it('pushes keyboard slider input into the widget', async () => {
    const { widget } = await renderAngleNode()

    const input = screen.getByLabelText('Horizontal angle') as HTMLInputElement
    input.value = '45'
    input.dispatchEvent(new Event('input'))

    expect(widget.setState).toHaveBeenCalledWith({
      azimuth: 45,
      elevation: 5,
      distance: 7
    })
  })

  it('labels the sliders with the camera vocabulary', async () => {
    await renderAngleNode()

    expect(
      screen.getByLabelText('Horizontal angle').getAttribute('aria-valuetext')
    ).toBe('front view')
    expect(screen.getByLabelText('Zoom').getAttribute('aria-valuetext')).toBe(
      'close-up'
    )
  })

  it('pauses off screen, resumes on screen, and disposes on unmount', async () => {
    const { widget, unmount } = await renderAngleNode()

    const pauseObserver = FakeIntersectionObserver.instances.at(-1)!
    pauseObserver.intersect(false)
    expect(widget.pause).toHaveBeenCalled()

    pauseObserver.intersect(true)
    expect(widget.resume).toHaveBeenCalled()

    unmount()
    expect(widget.dispose).toHaveBeenCalled()
  })
})
