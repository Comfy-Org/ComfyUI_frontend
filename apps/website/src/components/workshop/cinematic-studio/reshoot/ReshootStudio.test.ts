import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref } from 'vue'

import { readGeometry } from '@/lib/workshop/cinematic-studio/reshoot-engine/cvgeo'
import {
  fakeGeometry,
  fakeTransport,
  signIn
} from '@/lib/workshop/cinematic-studio/reshoot-engine/__fixtures__/reshootFakes'
import { reshootTransport } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport-config'
import { useWorkshopFlag } from '@/scripts/posthog'
import ReshootStudio from './ReshootStudio.vue'

vi.mock(import('@/config/workshop-session-state'))
vi.mock(import('@/config/workshop-credits'))
vi.mock(import('@/scripts/posthog'))
vi.mock(
  import('@/lib/workshop/cinematic-studio/reshoot-engine/transport-config'),
  () => ({ reshootTransport: vi.fn() })
)
vi.mock(import('@/lib/workshop/cinematic-studio/reshoot-engine/cvgeo'), () => ({
  readGeometry: vi.fn()
}))

function setup() {
  render(ReshootStudio)
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

function showFullScreen(on: boolean) {
  vi.mocked(useWorkshopFlag).mockImplementation((name) =>
    readonly(ref(on && name === 'workshop-reshoot-fullscreen-enabled'))
  )
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.mocked(reshootTransport).mockReturnValue(fakeTransport())
  vi.mocked(readGeometry).mockResolvedValue(fakeGeometry())
  vi.mocked(fetch).mockImplementation(
    async () => new Response(new Blob(['clip'], { type: 'video/mp4' }))
  )
  signIn()
})

describe('Re-shoot on one screen', () => {
  async function pickExample(user: ReturnType<typeof setup>) {
    await user.click(screen.getByRole('button', { name: /Sci-fi pilot/ }))
    await vi.advanceTimersByTimeAsync(3000)
  }

  it('reads the scene as soon as a clip is picked, then aims from the globe', async () => {
    const user = setup()
    expect(screen.queryByTestId('reshoot-action')).toBeNull()
    expect(screen.getByTestId('reshoot-empty')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Sci-fi pilot/ }))

    expect(screen.getByRole('status')).toHaveTextContent('Estimating depth')
    expect(screen.getByTestId('reshoot-action')).toBeDisabled()
    expect(screen.getByRole('slider', { name: 'Rotation' })).toBeDisabled()

    await vi.advanceTimersByTimeAsync(3000)
    screen.getByTestId('reshoot-globe').focus()
    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('slider', { name: 'Rotation' })).toHaveValue('-25')
    expect(screen.getByTestId('reshoot-action')).toBeEnabled()
  })

  it('shows what the next take costs above Generate', async () => {
    const user = setup()
    await pickExample(user)

    expect(screen.getByTestId('reshoot-price')).toHaveTextContent(
      'Free · 3 of 5 left this week'
    )
  })

  it('lets only the latest scene reading finish', async () => {
    const user = setup()
    const example = () => screen.getByRole('button', { name: /Sci-fi pilot/ })

    await user.click(example())
    await vi.advanceTimersByTimeAsync(1000)
    await user.click(example())
    await vi.advanceTimersByTimeAsync(1500)
    expect(screen.getByTestId('reshoot-action')).toBeDisabled()

    await vi.advanceTimersByTimeAsync(1000)
    expect(screen.getByTestId('reshoot-action')).toBeEnabled()
  })

  it.for([
    { start: 'the globe', tilts: false },
    { start: 'the camera handle', tilts: true }
  ])(
    'leaves vertical touch drags from $start to the page scroll unless it is the handle: tilts $tilts',
    async ({ start, tilts }) => {
      const user = setup()
      await pickExample(user)
      const globe = screen.getByTestId('reshoot-globe')
      const target = screen.getByTestId(
        start === 'the globe' ? 'reshoot-globe' : 'reshoot-globe-handle'
      )

      await user.pointer([
        { keys: '[TouchA>]', target, coords: { clientX: 100, clientY: 100 } },
        {
          pointerName: 'TouchA',
          target: globe,
          coords: { clientX: 110, clientY: 60 }
        }
      ])

      expect(screen.getByRole('slider', { name: 'Rotation' })).toHaveValue(
        '-24'
      )
      expect(screen.getByRole('slider', { name: 'Tilt' })).toHaveValue(
        tilts ? '31' : '15'
      )
    }
  )

  it('lines up a take next to the picture and cancels it there', async () => {
    const user = setup()
    await pickExample(user)

    await user.click(screen.getByTestId('reshoot-action'))

    expect(
      screen.getByRole('button', { name: 'Take 1 · az -30° el 15°' })
    ).toHaveAttribute('aria-current', 'true')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('status')).toHaveTextContent('Cancelled')
  })

  it('asks before the page is left while a take renders', async () => {
    const user = setup()
    await pickExample(user)
    const leave = () => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }
    expect(leave()).toBe(false)

    await user.click(screen.getByTestId('reshoot-action'))

    expect(leave()).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(leave()).toBe(false)
  })

  it("aims again from a finished take's angle", async () => {
    const user = setup()
    await pickExample(user)
    await user.click(screen.getByTestId('reshoot-action'))
    await vi.advanceTimersByTimeAsync(6500)
    screen.getByTestId('reshoot-globe').focus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    await user.click(
      screen.getByRole('button', { name: 'Take 1 · az -30° el 15°' })
    )

    await user.click(
      screen.getByRole('button', { name: 'Use this angle again' })
    )

    expect(screen.getByRole('slider', { name: 'Rotation' })).toHaveValue('-30')
    expect(
      screen.getByRole('button', { name: 'Aim', current: true })
    ).toBeInTheDocument()
  })
})

describe('Re-shoot full screen flag', () => {
  const editorAttribute = () =>
    document.documentElement.hasAttribute('data-workshop-editor')

  it.for([
    { on: false, hero: 1, editors: 0, attribute: false },
    { on: true, hero: 0, editors: 1, attribute: true }
  ])(
    'renders the page layout or the editor shell: flag $on',
    ({ on, hero, editors, attribute }) => {
      showFullScreen(on)
      const { unmount } = render(ReshootStudio)

      expect(screen.queryAllByTestId('reshoot-hero')).toHaveLength(hero)
      expect(
        screen.queryAllByRole('region', { name: 'Re-shoot a video' })
      ).toHaveLength(editors)
      expect(screen.queryAllByRole('toolbar')).toHaveLength(0)
      expect(editorAttribute()).toBe(attribute)

      unmount()
      expect(editorAttribute()).toBe(false)
    }
  )

  it.for([
    { on: false, toggles: 1 },
    { on: true, toggles: 0 }
  ])(
    'keeps the stage full screen toggle only on the page: flag $on',
    async ({ on, toggles }) => {
      showFullScreen(on)
      const user = setup()

      await user.click(screen.getByRole('button', { name: /Sci-fi pilot/ }))
      await vi.advanceTimersByTimeAsync(3000)

      expect(
        screen.queryAllByRole('button', { name: 'Full screen' })
      ).toHaveLength(toggles)
      expect(screen.getByTestId('reshoot-action')).toBeEnabled()
    }
  )

  it('runs a take in the editor and downloads it with the chosen sound', async () => {
    showFullScreen(true)
    const user = setup()
    await user.click(screen.getByRole('button', { name: /Sci-fi pilot/ }))
    await vi.advanceTimersByTimeAsync(3000)

    await user.click(screen.getByTestId('reshoot-action'))
    await vi.advanceTimersByTimeAsync(6500)

    const download = () => screen.getByRole('link', { name: 'Download' })
    expect(download()).toHaveAttribute('download', 'crossview-take-1.mp4')

    await user.click(screen.getByRole('button', { name: 'Original audio' }))
    expect(download()).toHaveAttribute(
      'download',
      'crossview-take-1-original-audio.mp4'
    )

    await user.click(
      screen.getByRole('button', { name: 'Use this angle again' })
    )
    expect(
      screen.getByRole('button', { name: 'Aim', current: true })
    ).toBeInTheDocument()
  })
})
