import userEvent from '@testing-library/user-event'
import { within } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubIntersectionObserver } from '@/test/fakeIntersectionObserver'
import './vfx-connected'

class ShowcaseResizeObserver implements ResizeObserver {
  static instances: ShowcaseResizeObserver[] = []

  constructor(readonly callback: ResizeObserverCallback) {
    ShowcaseResizeObserver.instances.push(this)
  }

  observe() {}
  unobserve() {}
  disconnect() {}

  resize() {
    this.callback([], this)
  }
}

function mountShowcase() {
  const root = document.createElement('vfx-workflow-showcase')
  root.dataset.vfxDemo = 'relight'
  root.innerHTML = `
    <div class="vfx-showcase-view" data-testid="showcase">
      <button data-open-studio="settings" aria-expanded="false">Open studio</button>
      <div class="vfx-canvas-window" tabindex="0" aria-label="Workflow canvas" data-testid="canvas">
        <div class="vfx-canvas-scale" data-testid="scale">
          <div class="vfx-scene-stage" data-testid="stage">
            <div class="vfx-source-node" data-canvas-step><div class="wf-node-heading">Original footage</div></div>
            <div class="vfx-keyframe-node" data-canvas-step><img alt="Key frame" src="/golden.jpg"></div>
            <div class="vfx-main-node" data-canvas-step>
              <span class="wf-node-heading"><span data-testid="workflow-node-label">Golden hour</span></span>
              <img alt="Golden hour" src="/golden.jpg">
              <video aria-label="Result video" data-src="/golden.mp4"></video>
            </div>
          </div>
        </div>
      </div>
      <button data-workflow-variant="relight_golden" aria-label="Golden hour" aria-pressed="true">Golden hour</button>
      <button data-workflow-variant="relight_night" aria-label="Night" aria-pressed="false">Night</button>
    </div>
    <div class="vfx-studio-view" data-testid="studio" hidden inert>
      <button data-back-workflow>Back to examples</button>
      <div data-playback-time="1.75"></div>
    </div>
  `
  const view = within(root)
  const canvas = view.getByTestId('canvas')
  const stage = view.getByTestId('stage')
  const scale = view.getByTestId('scale')
  const width = vi.spyOn(scale, 'offsetWidth', 'get').mockReturnValue(780)
  vi.spyOn(canvas, 'clientWidth', 'get').mockReturnValue(780)
  document.body.append(root)
  return { root, view, canvas, stage, width }
}

beforeEach(() => {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { ready: Promise.resolve() }
  })
  stubIntersectionObserver()
  ShowcaseResizeObserver.instances = []
  vi.stubGlobal('ResizeObserver', ShowcaseResizeObserver)
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  vi.spyOn(media, 'matches', 'get').mockReturnValue(true)
  vi.stubGlobal('matchMedia', () => media)
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
})

afterEach(() => {
  document.body.replaceChildren()
  Reflect.deleteProperty(document, 'fonts')
})

describe('VFX workflow canvas', () => {
  it('selects the variant and updates the key frame, output and label together', async () => {
    const user = userEvent.setup()
    const { root, view } = mountShowcase()
    await user.click(view.getByRole('button', { name: 'Night' }))
    expect(root).toHaveAttribute('data-selected-variant', 'relight_night')
    expect(view.getByRole('button', { name: 'Night' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(view.getByRole('button', { name: 'Golden hour' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(view.getByTestId('workflow-node-label')).toHaveTextContent('Night')
    expect(view.getByRole('img', { name: 'Key frame' })).toHaveAttribute(
      'src',
      'https://media.comfy.org/website/vfx/v3/2026-10-19-43beb0de27/relight_night.jpg'
    )
    expect(view.getByRole('img', { name: 'Night' })).toHaveAttribute(
      'src',
      'https://media.comfy.org/website/vfx/v3/2026-10-19-43beb0de27/relight_night.jpg'
    )
  })

  it('closes the studio with Escape and restores visibility, inertness and trigger focus', async () => {
    const user = userEvent.setup()
    const { root, view, stage } = mountShowcase()
    const open = view.getByRole('button', { name: 'Open studio' })
    const originalTransform = stage.style.transform
    await user.click(open)
    expect(root).toHaveAttribute('data-workspace')
    expect(open).toHaveAttribute('aria-expanded', 'true')
    expect(view.getByTestId('showcase')).toHaveProperty('inert', true)
    expect(view.getByTestId('studio')).toHaveProperty('hidden', false)
    expect(view.getByTestId('studio')).toHaveProperty('inert', false)
    expect(view.getByRole('button', { name: 'Back to examples' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(root).not.toHaveAttribute('data-workspace')
    expect(view.getByTestId('studio')).toHaveProperty('hidden', true)
    expect(view.getByTestId('studio')).toHaveProperty('inert', true)
    expect(view.getByTestId('showcase')).toHaveProperty('inert', false)
    expect(open).toHaveAttribute('aria-expanded', 'false')
    expect(open).toHaveFocus()
    expect(stage.style.transform).toBe(originalTransform)
  })

  it.for([
    { time: 1.25, duration: 5, expected: 1.25 },
    { time: 99, duration: 4.5, expected: 4.45 }
  ])(
    'restores pending playback $time within a $duration-second result',
    ({ time, duration, expected }) => {
      const { root, view } = mountShowcase()
      const video = view.getByLabelText<HTMLVideoElement>('Result video')
      vi.spyOn(video, 'readyState', 'get').mockReturnValue(0)
      vi.spyOn(video, 'duration', 'get').mockReturnValue(duration)
      root.dispatchEvent(
        new CustomEvent('workflow-time-change', { detail: { time } })
      )
      expect(video.currentTime).toBe(0)
      video.dispatchEvent(new Event('loadedmetadata'))
      expect(video.currentTime).toBe(expected)
    }
  )

  it('keeps keyboard navigation inside the canvas bounds after a wider resize', async () => {
    const user = userEvent.setup()
    const { canvas, stage, width } = mountShowcase()
    width.mockReturnValue(420)
    ShowcaseResizeObserver.instances[0].resize()
    canvas.focus()
    await user.keyboard('{End}')
    expect(stage.style.transform).toContain('-740px')
    width.mockReturnValue(780)
    ShowcaseResizeObserver.instances[0].resize()
    expect(stage.style.transform).toContain('-380px')
    await user.keyboard('{ArrowRight}')
    expect(stage.style.transform).toContain('-380px')
    await user.keyboard('{Home}{ArrowLeft}')
    expect(stage.style.transform).toBe('translate(0, 0)')
  })
})
