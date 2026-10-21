import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { assert, beforeEach, expect, it, vi } from 'vitest'

import { nextTick } from 'vue'

import VfxSampleStudio from './VfxSampleStudio.vue'

import { stubIntersectionObserver } from '@/test/fakeIntersectionObserver'

beforeEach(() => {
  vi.stubGlobal(
    'HTMLMediaElement',
    class extends HTMLMediaElement {
      static override readonly HAVE_METADATA = 1
    }
  )
  stubIntersectionObserver()
})

it('restores the selected sample and builds the request from edited settings', async () => {
  const user = userEvent.setup()
  const showcase = document.createElement('vfx-workflow-showcase')
  showcase.dataset.selectedVariant = 'relight_night'
  document.body.append(showcase)
  render(VfxSampleStudio, {
    container: showcase,
    props: {
      demo: 'relight',
      source: 'relight_before',
      mediaKind: 'video',
      variants: [
        { id: 'relight_golden', label: 'Golden hour' },
        { id: 'relight_night', label: 'Night' }
      ],
      workflowHref: 'https://cloud.comfy.org/?workflow=8b18c850d38a'
    }
  })

  await user.click(screen.getByRole('tab', { name: 'SETTINGS' }))
  expect(screen.getByRole('button', { name: 'Night' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await user.click(screen.getByRole('button', { name: 'Golden hour' }))
  expect(showcase).toHaveAttribute('data-selected-variant', 'relight_golden')
  expect(screen.getByRole('button', { name: 'Night' })).toHaveAttribute(
    'aria-pressed',
    'false'
  )
  const description = screen.getByRole('textbox', { name: 'Describe the shot' })
  await user.clear(description)
  await user.type(description, 'A car arrives at the diner.')
  await user.type(
    screen.getByRole('textbox', { name: 'Describe the light and weather' }),
    'Warm sunset'
  )
  await user.click(screen.getByRole('tab', { name: 'WORKFLOW' }))

  expect(screen.getByText(/Selected sample: Warm sunset/)).toHaveTextContent(
    'Selected sample: Warm sunset Shot description: A car arrives at the diner.'
  )
  expect(
    screen.getByRole('link', { name: 'EXPOSE WORKFLOW ↗' })
  ).toHaveAttribute('href', 'https://cloud.comfy.org/?workflow=8b18c850d38a')
})

it('recovers from a failed original clip when another sample is selected', async () => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  const user = userEvent.setup()
  const observers = stubIntersectionObserver()
  render(VfxSampleStudio, {
    props: {
      demo: 'relight',
      source: 'diner',
      mediaKind: 'video',
      variants: [
        { id: 'relight_golden', label: 'Golden hour' },
        { id: 'relight_night', label: 'Night' }
      ]
    }
  })
  await nextTick()
  const surface = screen.getByTestId('video-compare-surface')
  const observer = observers.instances[0]
  assert.exists(observer)
  const bounds = new DOMRect(0, 0, 400, 225)
  observer.callback(
    [
      {
        target: surface,
        boundingClientRect: bounds,
        intersectionRect: bounds,
        rootBounds: null,
        isIntersecting: true,
        intersectionRatio: 1,
        time: 0
      }
    ],
    new IntersectionObserver(() => undefined)
  )
  await nextTick()
  const before = screen.getByTestId<HTMLVideoElement>('video-compare-before')
  const initialAfter = screen.getByTestId<HTMLVideoElement>(
    'video-compare-after'
  )
  vi.spyOn(before, 'readyState', 'get').mockReturnValue(3)
  vi.spyOn(before, 'duration', 'get').mockReturnValue(8)
  before.dispatchEvent(new Event('loadedmetadata'))
  vi.spyOn(initialAfter, 'readyState', 'get').mockReturnValue(3)
  vi.spyOn(initialAfter, 'duration', 'get').mockReturnValue(8)
  initialAfter.dispatchEvent(new Event('loadedmetadata'))
  await waitFor(() => expect(before.paused).toBe(false))
  vi.spyOn(before, 'error', 'get').mockReturnValue({
    code: 2,
    message: 'Network error',
    MEDIA_ERR_ABORTED: 1,
    MEDIA_ERR_NETWORK: 2,
    MEDIA_ERR_DECODE: 3,
    MEDIA_ERR_SRC_NOT_SUPPORTED: 4
  })
  const reload = vi.spyOn(before, 'load')
  before.dispatchEvent(new Event('error'))
  await waitFor(() => expect(before.paused).toBe(true))
  await user.click(screen.getByRole('tab', { name: 'SETTINGS' }))
  await user.click(screen.getByRole('button', { name: 'Night' }))
  const after = screen.getByTestId<HTMLVideoElement>('video-compare-after')
  vi.spyOn(after, 'readyState', 'get').mockReturnValue(3)
  vi.spyOn(after, 'duration', 'get').mockReturnValue(8)
  after.dispatchEvent(new Event('canplay'))
  await waitFor(() => {
    expect(reload).toHaveBeenCalledOnce()
    expect(before.paused).toBe(false)
    expect(after.paused).toBe(false)
  })
})

async function renderVisibleStudio(isPaused: boolean) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  const showcase = document.createElement('vfx-workflow-showcase')
  showcase.dataset.playbackPaused = String(isPaused)
  const studioView = document.createElement('div')
  studioView.className = 'vfx-studio-view'
  showcase.append(studioView)
  document.body.append(showcase)
  const observers = stubIntersectionObserver()
  render(VfxSampleStudio, {
    container: studioView,
    props: {
      demo: 'relight',
      source: 'diner',
      mediaKind: 'video',
      variants: [
        { id: 'relight_golden', label: 'Golden hour' },
        { id: 'relight_night', label: 'Night' }
      ]
    }
  })
  await nextTick()
  const observer = observers.instances[0]
  assert.exists(observer)
  const surface = screen.getByTestId('video-compare-surface')
  const bounds = new DOMRect(0, 0, 400, 225)
  observer.callback(
    [
      {
        target: surface,
        boundingClientRect: bounds,
        intersectionRect: bounds,
        rootBounds: null,
        isIntersecting: true,
        intersectionRatio: 1,
        time: 0
      }
    ],
    new IntersectionObserver(() => undefined)
  )
  await nextTick()
  const before = screen.getByTestId<HTMLVideoElement>('video-compare-before')
  const after = screen.getByTestId<HTMLVideoElement>('video-compare-after')
  vi.spyOn(before, 'readyState', 'get').mockReturnValue(3)
  vi.spyOn(before, 'duration', 'get').mockReturnValue(8)
  before.dispatchEvent(new Event('loadedmetadata'))
  vi.spyOn(after, 'readyState', 'get').mockReturnValue(3)
  vi.spyOn(after, 'duration', 'get').mockReturnValue(8)
  after.dispatchEvent(new Event('loadedmetadata'))
  await nextTick()
  return { showcase, studioView, before, after }
}

it('keeps the showcase pause when selecting another Studio sample', async () => {
  const user = userEvent.setup()
  const { showcase, before } = await renderVisibleStudio(true)
  await user.click(screen.getByRole('tab', { name: 'SETTINGS' }))
  await user.click(screen.getByRole('button', { name: 'Night' }))
  const after = screen.getByTestId<HTMLVideoElement>('video-compare-after')
  vi.spyOn(after, 'readyState', 'get').mockReturnValue(3)
  vi.spyOn(after, 'duration', 'get').mockReturnValue(8)
  after.dispatchEvent(new Event('loadedmetadata'))
  await nextTick()
  expect(before.paused).toBe(true)
  expect(after.paused).toBe(true)
  showcase.dataset.playbackPaused = 'false'
  showcase.dispatchEvent(
    new CustomEvent('workflow-playback-change', { detail: { paused: false } })
  )
  await waitFor(() => {
    expect(before.paused).toBe(false)
    expect(after.paused).toBe(false)
  })
})

it('keeps a hidden Studio pair paused when the canvas resumes before visibility updates', async () => {
  const { showcase, studioView, before, after } =
    await renderVisibleStudio(false)
  await waitFor(() => expect(before.paused).toBe(false))
  studioView.hidden = true
  studioView.inert = true
  before.pause()
  after.pause()
  showcase.dispatchEvent(
    new CustomEvent('workflow-playback-change', { detail: { paused: false } })
  )
  await nextTick()
  expect(before.paused).toBe(true)
  expect(after.paused).toBe(true)
})
