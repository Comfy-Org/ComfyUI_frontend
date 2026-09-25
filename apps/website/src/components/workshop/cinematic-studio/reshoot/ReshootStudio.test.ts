import {
  fireEvent,
  render,
  screen,
  waitFor as waitUntil
} from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readGeometry } from '../../../../lib/workshop/cinematic-studio/reshoot-engine/cvgeo'
import {
  cancel,
  download,
  submit,
  uploadVideo,
  waitFor
} from '../../../../lib/workshop/cinematic-studio/reshoot-engine/deployment'
import ReshootStudio from './ReshootStudio.vue'

// The network is the only thing stubbed: the page, the composable and the
// graph binding run as they do in the browser.
vi.mock(
  import('../../../../lib/workshop/cinematic-studio/reshoot-engine/deployment'),
  { spy: true }
)
vi.mock(
  import('../../../../lib/workshop/cinematic-studio/reshoot-engine/cvgeo'),
  { spy: true }
)

const net = {
  holdTakes: false,
  submitted: [] as Record<string, { inputs: Record<string, unknown> }>[]
}

function setup() {
  render(ReshootStudio)
  return userEvent.setup()
}

beforeEach(() => {
  net.holdTakes = false
  net.submitted = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new Blob(['clip'], { type: 'video/mp4' })))
  )
  vi.mocked(uploadVideo).mockResolvedValue('clip.mp4')
  vi.mocked(submit).mockImplementation(async (workflow) => {
    const graph = workflow as unknown as (typeof net.submitted)[number]
    net.submitted.push(graph)
    return '43' in graph ? 'take-job' : 'analyze-job'
  })
  vi.mocked(waitFor).mockImplementation(
    (id, _onUpdate, signal) =>
      new Promise((resolve, reject) => {
        const done = { id, status: 'succeeded', outputs: [] }
        if (id !== 'take-job' || !net.holdTakes) return resolve(done)
        signal.addEventListener('abort', () =>
          reject(new DOMException('Stopped', 'AbortError'))
        )
      })
  )
  vi.mocked(download).mockResolvedValue(new Blob(['x'], { type: 'video/mp4' }))
  vi.mocked(cancel).mockResolvedValue()
  vi.mocked(readGeometry).mockResolvedValue({
    frames: 107,
    width: 8,
    height: 4,
    fps: 24,
    sourceWidth: 960,
    sourceHeight: 544,
    fxNorm: null,
    jpegs: [],
    depth: [new Float32Array(32).fill(3)],
    depthHalf: [new Uint16Array(32)]
  })
})

const inputs = (
  workflow: Record<string, { inputs: Record<string, unknown> }>
) => workflow['5'].inputs

describe('Re-shoot, run for real', () => {
  async function analyzeExample(user: ReturnType<typeof setup>) {
    await user.click(screen.getByRole('button', { name: /Sci-fi pilot/ }))
    await user.click(screen.getByTestId('reshoot-analyze'))
    await waitUntil(() =>
      expect(screen.getByTestId('reshoot-action')).toBeEnabled()
    )
  }

  it('waits for Analyze depth, because the analysis is a run of its own', async () => {
    const user = setup()
    expect(screen.getByTestId('reshoot-empty')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Sci-fi pilot/ }))

    expect(net.submitted).toHaveLength(0)
    expect(screen.getByTestId('reshoot-action')).toBeDisabled()
    expect(screen.getByRole('slider', { name: 'Rotation' })).toBeDisabled()
    expect(screen.getByText('Analyze depth first.')).toBeInTheDocument()

    await user.click(screen.getByTestId('reshoot-analyze'))
    await waitUntil(() =>
      expect(screen.getByTestId('reshoot-action')).toBeEnabled()
    )
    expect(net.submitted).toHaveLength(1)
    expect(net.submitted[0]['2'].inputs).toMatchObject({
      aspect_ratio: 'source',
      megapixels: 0.4
    })

    screen.getByTestId('reshoot-globe').focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('slider', { name: 'Rotation' })).toHaveValue('-25')
  })

  it.for([
    { start: 'the globe', tilts: false },
    { start: 'the camera handle', tilts: true }
  ])(
    'leaves vertical touch drags from $start to the page scroll unless it is the handle: tilts $tilts',
    async ({ start, tilts }) => {
      const user = setup()
      await analyzeExample(user)
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

  it('sends the camera that was aimed', async () => {
    const user = setup()
    await analyzeExample(user)
    screen.getByTestId('reshoot-globe').focus()
    await user.keyboard('{ArrowRight}')

    await user.click(screen.getByTestId('reshoot-action'))

    await waitUntil(() => expect(net.submitted).toHaveLength(2))
    expect(inputs(net.submitted[1])).toMatchObject({
      azimuth: -25,
      elevation: 15,
      distance: 1,
      hfov: 50,
      pivot_override: true,
      keep_source_aim: true,
      use_keyframes: false
    })
  })

  it('lines up a take next to the picture and cancels it there', async () => {
    net.holdTakes = true
    const user = setup()
    await analyzeExample(user)

    await user.click(screen.getByTestId('reshoot-action'))

    await waitUntil(() =>
      expect(
        screen.getByRole('button', { name: 'Take 1 · az -30° el 15°' })
      ).toHaveAttribute('aria-current', 'true')
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitUntil(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Cancelled')
    )
  })

  it("aims again from a finished take's angle", async () => {
    const user = setup()
    await analyzeExample(user)
    await user.click(screen.getByTestId('reshoot-action'))
    await screen.findByRole('button', { name: 'Use this angle again' })
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

  describe('the camera move', () => {
    const rotation = () => screen.getByRole('slider', { name: 'Rotation' })
    const scrub = (frame: number) =>
      fireEvent.update(
        screen.getByRole('slider', { name: 'Frame' }),
        String(frame)
      )
    async function nudge(user: ReturnType<typeof setup>, times = 1) {
      screen.getByTestId('reshoot-globe').focus()
      await user.keyboard('{ArrowRight}'.repeat(times))
    }

    async function twoKeys(user: ReturnType<typeof setup>) {
      await analyzeExample(user)
      await user.click(screen.getByTestId('reshoot-key'))
      await scrub(50)
      await nudge(user, 2)
      await user.click(screen.getByTestId('reshoot-key'))
    }

    it('keys the camera on the timeline and flies the path between keys', async () => {
      const user = setup()
      await twoKeys(user)

      expect(screen.getByTestId('reshoot-key')).toHaveTextContent('Remove key')
      await scrub(25)
      expect(screen.getByTestId('reshoot-key')).toHaveTextContent('Key')
      expect(Number((rotation() as HTMLInputElement).value)).toBeGreaterThan(
        -30
      )
      expect(Number((rotation() as HTMLInputElement).value)).toBeLessThan(-20)

      await user.click(screen.getByTestId('reshoot-action'))
      await waitUntil(() => expect(net.submitted).toHaveLength(2))
      const sent = inputs(net.submitted[1])
      expect(sent.use_keyframes).toBe(true)
      expect(
        JSON.parse(String(sent.keyframes)).map(
          (k: { f: number; az: number }) => [k.f, k.az]
        )
      ).toEqual([
        [1, -30],
        [51, -20]
      ])
    })

    it('edits a key when aimed on it, and only tries a pose between keys', async () => {
      const user = setup()
      await twoKeys(user)

      await scrub(0)
      await nudge(user)
      await scrub(50)
      await scrub(0)
      expect(rotation()).toHaveValue('-25')

      await scrub(30)
      await nudge(user, 3)
      await scrub(31)
      await scrub(30)
      expect(screen.getByTestId('reshoot-key')).toHaveTextContent('Key')
      expect(
        screen.getAllByRole('button', { name: /Go to the key at/ })
      ).toHaveLength(4)
    })

    it('takes a key away with the same button, and holds a single key', async () => {
      const user = setup()
      await twoKeys(user)
      await user.click(screen.getByTestId('reshoot-key'))

      await scrub(0)
      await user.click(screen.getByTestId('reshoot-action'))
      await waitUntil(() => expect(net.submitted).toHaveLength(2))
      expect(inputs(net.submitted[1])).toMatchObject({
        azimuth: -30,
        use_keyframes: false
      })
    })
  })
})
