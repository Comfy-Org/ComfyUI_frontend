import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readGeometry } from '../../../../lib/workshop/cinematic-studio/reshoot-engine/cvgeo'
import {
  fakeGeometry,
  fakeTransport,
  signIn
} from '../../../../lib/workshop/cinematic-studio/reshoot-engine/__fixtures__/reshootFakes'
import { reshootTransport } from '../../../../lib/workshop/cinematic-studio/reshoot-engine/transport-config'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import ReshootStudio from './ReshootStudio.vue'

vi.mock(import('../../../../config/workshop-session-state'))
vi.mock(import('../../../../config/workshop-credits'))
vi.mock(import('../../../../scripts/posthog'))
vi.mock(
  import('../../../../lib/workshop/cinematic-studio/reshoot-engine/transport-config'),
  () => ({ reshootTransport: vi.fn() })
)
vi.mock(
  import('../../../../lib/workshop/cinematic-studio/reshoot-engine/cvgeo'),
  () => ({ readGeometry: vi.fn() })
)

function setup() {
  render(ReshootStudio)
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

beforeEach(() => {
  localStorage.clear()
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
  async function pickExample(user: ReturnType<typeof setup>) {
    await user.click(screen.getByRole('button', { name: /Sci-fi pilot/ }))
    await vi.advanceTimersByTimeAsync(3000)
  }

  it('reads the scene as soon as a clip is picked, then aims from the globe', async () => {
    const user = setup()
    expect(screen.queryByTestId('reshoot-action')).toBeNull()
    expect(screen.getByTestId('reshoot-empty')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Sci-fi pilot/ }))

    expect(screen.getByTestId('reshoot-depth-step')).toHaveTextContent(
      rc('reshoot.pending.depth')
    )
    expect(screen.getByTestId('reshoot-frame-label')).toHaveTextContent(
      `${rc('reshoot.frameLabel.original')} · ${rc('reshoot.frameLabel.nothingYet')}`
    )
    expect(screen.getByTestId('reshoot-aim-controls')).toHaveAttribute('inert')
    expect(screen.getByTestId('reshoot-action')).toBeDisabled()

    await vi.advanceTimersByTimeAsync(3000)
    expect(screen.queryByTestId('reshoot-aim-pending')).toBeNull()
    expect(screen.getByTestId('reshoot-aim-controls')).not.toHaveAttribute(
      'inert'
    )
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

  it('says how many takes are left this hour and stops at the limit', async () => {
    const user = setup()
    await pickExample(user)
    const limit = () => screen.getByTestId('reshoot-limit')
    expect(limit()).toHaveTextContent('3 of 3 takes left this hour')

    const takeAndCancel = async () => {
      await user.click(screen.getByTestId('reshoot-action'))
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
    }
    await takeAndCancel()
    expect(limit()).toHaveTextContent('2 of 3 takes left this hour')
    await takeAndCancel()
    expect(limit()).toHaveTextContent('1 of 3 takes left this hour')
    await takeAndCancel()

    expect(limit()).toHaveTextContent('No takes left this hour')
    expect(screen.getByTestId('reshoot-action')).toBeDisabled()
  })

  it('names the hourly ceiling when too many clips were analyzed', async () => {
    localStorage.setItem(
      'comfy.reshoot.runs.depth.user-1',
      JSON.stringify(Array.from({ length: 20 }, () => Date.now()))
    )
    const user = setup()
    await pickExample(user)

    expect(screen.getByTestId('reshoot-depth-step')).toHaveTextContent(
      'Too many clips analyzed this hour'
    )
    expect(screen.getByTestId('reshoot-analyze')).toBeInTheDocument()
    expect(screen.getByTestId('reshoot-action')).toBeDisabled()
  })
})
