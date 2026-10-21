import userEvent from '@testing-library/user-event'
import { within } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubIntersectionObserver } from '@/test/fakeIntersectionObserver'
import './vfx-connected'
import { vfxMediaRoot, vfxRedSkyMedia } from '@/data/vfxMedia'
import { ScrollTrigger } from './gsapSetup'

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
      ${[
        ['golden', 'Golden hour'],
        ['night', 'Night'],
        ['blue', 'Red sky'],
        ['rain', 'Rain'],
        ['snow', 'Snow'],
        ['day', 'Daylight']
      ]
        .map(
          ([id, label]) =>
            `<button data-workflow-variant="relight_${id}" aria-label="${label}" aria-pressed="${id === 'golden'}">${label}</button>`
        )
        .join('')}
    </div>
    <div class="vfx-studio-view" data-testid="studio" hidden inert>
      <button data-back-workflow>Back to VFX page</button>
      <div data-vfx-studio data-playback-time="1.75"></div>
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
  vi.stubGlobal(
    'HTMLMediaElement',
    class extends HTMLMediaElement {
      static override readonly HAVE_METADATA = 1
    }
  )
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
    expect(view.getByRole('button', { name: 'Back to VFX page' })).toHaveFocus()
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

it('retains a pending output position across rapid source changes', async () => {
  const user = userEvent.setup()
  const { root, view } = mountShowcase()
  const video = view.getByLabelText<HTMLVideoElement>('Result video')
  root.dispatchEvent(
    new CustomEvent('workflow-time-change', { detail: { time: 2.5 } })
  )
  await user.click(view.getByRole('button', { name: 'Night' }))
  await user.click(view.getByRole('button', { name: 'Golden hour' }))
  vi.spyOn(video, 'duration', 'get').mockReturnValue(8)
  video.dispatchEvent(new Event('loadedmetadata'))
  expect(video.currentTime).toBe(2.5)
})

it('seeds a new sequence player from the Studio rather than the hidden canvas', async () => {
  const { view } = mountShowcase()
  const canvasVideo = view.getByLabelText<HTMLVideoElement>('Result video')
  canvasVideo.dataset.playbackTime = '0'
  const studio = view.getByTestId('studio')
  const player = document.createElement('div')
  player.dataset.vfxSequencePlayer = ''
  const video = document.createElement('video')
  player.append(video)
  studio.append(player)
  await vi.waitFor(() => expect(video.dataset.playbackTime).toBe('1.75'))
})

it.for([
  {
    label: 'Golden hour',
    poster: `${vfxMediaRoot}/relight_golden.jpg`,
    video: `${vfxMediaRoot}/relight_golden.mp4`
  },
  {
    label: 'Night',
    poster: `${vfxMediaRoot}/relight_night.jpg`,
    video: `${vfxMediaRoot}/relight_night.mp4`
  },
  {
    label: 'Red sky',
    poster: vfxRedSkyMedia.poster,
    video: vfxRedSkyMedia.video
  },
  {
    label: 'Rain',
    poster: `${vfxMediaRoot}/relight_rain.jpg`,
    video: `${vfxMediaRoot}/relight_rain.mp4`
  },
  {
    label: 'Snow',
    poster: `${vfxMediaRoot}/relight_snow.jpg`,
    video: `${vfxMediaRoot}/relight_snow.mp4`
  },
  {
    label: 'Daylight',
    poster: `${vfxMediaRoot}/relight_day.jpg`,
    video: `${vfxMediaRoot}/relight_day.mp4`
  }
])(
  'selects the $label image, output video and poster',
  async ({ label, poster, video: expectedVideo }) => {
    const user = userEvent.setup()
    const { view } = mountShowcase()
    await user.click(view.getByRole('button', { name: label }))
    expect(view.getByTestId('workflow-node-label')).toHaveTextContent(label)
    expect(view.getByRole('img', { name: 'Key frame' })).toHaveAttribute(
      'src',
      poster
    )
    const video = view.getByLabelText<HTMLVideoElement>(label, {
      selector: 'video'
    })
    expect(video).toHaveAttribute('src', expectedVideo)
    expect(video).toHaveProperty('poster', poster)
  }
)

it('resumes visible canvas previews when reduced motion is turned off', async () => {
  const observers = stubIntersectionObserver()
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  const matches = vi.spyOn(media, 'matches', 'get').mockReturnValue(true)
  const { view } = mountShowcase()
  const video = view.getByLabelText<HTMLVideoElement>('Result video')
  observers.instances[0].intersect(true)
  expect(video.paused).toBe(true)
  matches.mockReturnValue(false)
  media.dispatchEvent(new Event('change'))
  await vi.waitFor(() => expect(video.paused).toBe(false))
})

it('cancels the pending canvas reveal when the user navigates the canvas', async () => {
  const create = vi.spyOn(ScrollTrigger, 'create')
  const user = userEvent.setup()
  const { canvas } = mountShowcase()
  const trigger = create.mock.results[0]?.value
  const kill = vi.spyOn(trigger, 'kill')
  canvas.focus()
  await user.keyboard('{ArrowLeft}')
  expect(kill).toHaveBeenCalled()
})

function mountVisibleShowcase(reduced = false) {
  const observers = stubIntersectionObserver()
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  vi.spyOn(media, 'matches', 'get').mockReturnValue(reduced)
  const result = mountShowcase()
  const video = result.view.getByLabelText<HTMLVideoElement>('Result video')
  const observer = observers.instances[0]
  observer.intersect(true)
  return { ...result, video, observer }
}

function addSequencePlayer(studio: HTMLElement) {
  const player = document.createElement('div')
  player.dataset.vfxSequencePlayer = ''
  const sequence = document.createElement('video')
  sequence.setAttribute('aria-label', 'Sequence result')
  player.append(sequence)
  studio.append(player)
  return sequence
}

it('plays only the Studio while open and resumes the canvas when closed', async () => {
  const user = userEvent.setup()
  const { view, video: canvasVideo, observer } = mountVisibleShowcase()
  const sequence = addSequencePlayer(view.getByTestId('studio'))
  await vi.waitFor(() => expect(observer.observed).toContain(sequence))
  await user.click(view.getByRole('button', { name: 'Open studio' }))
  observer.intersect(true)
  expect(sequence.paused).toBe(false)
  expect(canvasVideo.paused).toBe(true)
  await user.click(view.getByRole('button', { name: 'Back to VFX page' }))
  observer.intersect(true)
  expect(sequence.paused).toBe(true)
  expect(canvasVideo.paused).toBe(false)
})

it('keeps the Studio paused for a reduced-motion visitor', async () => {
  const user = userEvent.setup()
  const { root, view, observer } = mountVisibleShowcase(true)
  const sequence = addSequencePlayer(view.getByTestId('studio'))
  await vi.waitFor(() => expect(observer.observed).toContain(sequence))
  await user.click(view.getByRole('button', { name: 'Open studio' }))
  observer.intersect(true)
  expect(sequence.paused).toBe(true)
  expect(root).toHaveAttribute('data-playback-paused', 'true')
})
