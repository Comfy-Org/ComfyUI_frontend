import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { translationsFor } from '@/i18n/translations'
import { RESHOOT_EXAMPLE } from '@/lib/workshop/cinematic-studio/reshoot'
import { readGeometry } from '@/lib/workshop/cinematic-studio/reshoot-engine/cvgeo'
import {
  fakeGeometry,
  fakeTransport,
  signIn
} from '@/lib/workshop/cinematic-studio/reshoot-engine/__fixtures__/reshootFakes'
import { reshootTransport } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport-config'
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
vi.mock(import('@/lib/workshop/cinematic-studio/reshoot-clip'), () => ({
  clipSecondsOf: vi.fn(async () => Number.NaN),
  fileSecondsOf: vi.fn(async () => 10)
}))

const { t: rc } = translationsFor('en')

function setup() {
  render(ReshootStudio)
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.mocked(reshootTransport).mockReturnValue(fakeTransport())
  vi.mocked(readGeometry).mockResolvedValue(fakeGeometry())
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new Blob(['clip'], { type: 'video/mp4' })))
  )
  signIn()
})

describe('Re-shoot on one screen', () => {
  async function readExample() {
    await vi.advanceTimersByTimeAsync(3000)
  }

  function chooseClip(user: ReturnType<typeof setup>, name = 'mine.mp4') {
    return user.upload(
      screen.getByLabelText(new RegExp(rc('reshoot.clip.upload'))),
      new File(['clip'], name, { type: 'video/mp4' })
    )
  }

  it('lands in the editor on the example clip with its result take shown', async () => {
    setup()

    expect(
      screen.getByRole('button', { name: rc('reshoot.take.example') })
    ).toHaveAttribute('aria-current', 'true')
    expect(
      screen.getByRole('link', { name: rc('reshoot.download') })
    ).toHaveAttribute('href', RESHOOT_EXAMPLE.result)
  })

  it('reads the example scene on arrival, then aims from the globe', async () => {
    const user = setup()
    expect(await screen.findByTestId('reshoot-action')).toBeDisabled()
    expect(screen.queryByRole('slider', { name: 'Rotation' })).toBeNull()
    expect(screen.getByTestId('reshoot-camera-waiting')).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: rc('reshoot.step.clip') })
    ).toHaveAttribute('aria-current', 'step')

    await readExample()
    expect(
      screen.getByRole('region', { name: rc('reshoot.step.camera') })
    ).toHaveAttribute('aria-current', 'step')
    screen.getByTestId('reshoot-globe').focus()
    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('slider', { name: 'Rotation' })).toHaveValue('-25')
    expect(
      screen.getByRole('button', { name: 'Aim', current: true })
    ).toBeInTheDocument()
    expect(screen.getByTestId('reshoot-action')).toBeEnabled()
  })

  it('replaces the clip from the upload zone in the side panel', async () => {
    const transport = fakeTransport()
    vi.mocked(reshootTransport).mockReturnValue(transport)
    const user = setup()
    await readExample()

    await chooseClip(user)
    await readExample()

    expect(screen.getByText('mine.mp4')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Aim', current: true })
    ).toBeInTheDocument()
    expect(transport.upload).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: 'mine.mp4' }),
      expect.any(AbortSignal)
    )
  })

  it('shows what the next take costs above Generate', async () => {
    setup()
    await readExample()

    expect(screen.getByTestId('reshoot-price')).toHaveTextContent(
      'Free · 3 of 5 left this week'
    )
  })

  it('lets only the latest scene reading finish', async () => {
    const user = setup()

    await vi.advanceTimersByTimeAsync(1000)
    await chooseClip(user)
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
      await readExample()
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
    await readExample()

    await user.click(screen.getByTestId('reshoot-action'))

    expect(
      screen.getByRole('button', { name: 'Take 1 · az -30° el 15°' })
    ).toHaveAttribute('aria-current', 'true')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('status')).toHaveTextContent('Cancelled')
  })

  it('asks before the page is left while a take renders', async () => {
    const user = setup()
    await readExample()
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
    await readExample()
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
