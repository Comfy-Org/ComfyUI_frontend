import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import Companion from './Companion.vue'
import { TALK_FRAME_MS, talkDuration } from './companionPose'
import {
  REACTIONS,
  REACTION_COOLDOWN_MS,
  reactionDuration
} from './companionReactions'

type Props = ComponentProps<typeof Companion>

const FRAME_MS = 16
const DOCK = { x: 12, y: 600 }
const BESIDE_TARGET = { x: 266, y: 231 }
const LINE = 'I am checking which node sets the width.'

const baseProps: Props = {
  look: { goes: 'dock', pose: 'resting' },
  dock: DOCK,
  stand: null,
  points: 'right',
  speech: null,
  title: 'Ask the agent',
  disabled: false,
  accessibleAs: null
}

function renderCompanion(props: Partial<Props> = {}) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const rendered = render(Companion, { props: { ...baseProps, ...props } })
  return { user, ...rendered }
}

const companion = () => screen.getByTestId('point-at-it-companion')
const button = () => screen.getByTestId('point-at-it-companion-button')
const frame = () => companion().dataset.frame
const place = () => companion().style.transform

/** Lets that long go by, frame by frame, and the page catch up. */
async function frames(ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
}

function preferReducedMotion() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduce'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
}

describe('Companion: at the dock', () => {
  it('CP-01: waits at the dock, resting', () => {
    renderCompanion()

    expect(place()).toBe('translate(12px, 600px)')
    expect(frame()).toBe('idle')
    expect(companion().dataset.docked).toBe('true')
  })

  it('CP-01: follows the dock when the canvas changes size', async () => {
    const { rerender } = renderCompanion()

    await rerender({ dock: { x: 332, y: 498 } })
    await frames(1000)

    expect(place()).toBe('translate(332px, 498px)')
  })

  it('CP-03: a click on her asks to press Ask, and does nothing while Ask cannot be pressed', async () => {
    const { user, emitted, rerender } = renderCompanion()

    await user.click(button())
    expect(emitted('press')).toHaveLength(1)

    await rerender({ disabled: true })
    await user.click(button())
    expect(emitted('press')).toHaveLength(1)
  })

  it('CP-03, CP-25: beside the Ask strip she carries the Ask tooltip, and is no extra control for assistive technology', () => {
    renderCompanion({ title: 'Ask the agent about something (Q)' })

    expect(button()).toHaveAttribute(
      'title',
      'Ask the agent about something (Q)'
    )
    expect(button()).toHaveAttribute('aria-hidden', 'true')
    expect(button()).toHaveAttribute('tabindex', '-1')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('CP-24: without the strip she is the Ask button: named, with the tooltip, pressed as the mode is, and reachable by keyboard', async () => {
    const { user, rerender, emitted } = renderCompanion({
      title: 'Ask the agent about something (Q)',
      accessibleAs: { name: 'Ask', pressed: false }
    })

    const ask = screen.getByRole('button', { name: 'Ask' })
    expect(ask).toHaveAttribute('title', 'Ask the agent about something (Q)')
    expect(ask).toHaveAttribute('aria-pressed', 'false')

    await user.tab()
    expect(ask).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(emitted('press')).toHaveLength(1)

    await rerender({ accessibleAs: { name: 'Ask', pressed: true } })
    expect(ask).toHaveAttribute('aria-pressed', 'true')
  })

  it('CP-24, CP-16: as the Ask button she is disabled while she is away from the dock', async () => {
    const { rerender } = renderCompanion({
      accessibleAs: { name: 'Ask', pressed: false }
    })

    await rerender({
      look: { goes: 'target', pose: 'pointing' },
      stand: BESIDE_TARGET
    })
    await frames(FRAME_MS * 2)

    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled()
  })

  it('CP-16: takes clicks at the dock, and none anywhere else', async () => {
    const { rerender } = renderCompanion()

    expect(button()).toHaveClass('pointer-events-auto')

    await rerender({
      look: { goes: 'target', pose: 'pointing' },
      stand: BESIDE_TARGET
    })
    await frames(FRAME_MS * 2)

    expect(button()).toHaveClass('pointer-events-none')
    expect(button()).toBeDisabled()
  })
})

describe('Companion: saying the thinking', () => {
  const thinking = { goes: 'dock', pose: 'thinking' } as const

  it('CP-04: shows the line in a bubble that assistive technology reads as status', () => {
    renderCompanion({ look: thinking, speech: LINE })

    expect(screen.getByRole('status')).toHaveTextContent(LINE)
  })

  it('CP-18: her mouth moves through the talking frames while she says it, then she goes back to thinking', async () => {
    renderCompanion({ look: thinking, speech: LINE })
    await frames(FRAME_MS)
    expect(frame()).toBe('talk-open')

    await frames(TALK_FRAME_MS)
    expect(frame()).toBe('talk-wide')

    await frames(talkDuration(LINE))
    expect(frame()).toBe('thinking')
    expect(screen.getByRole('status')).toHaveTextContent(LINE)
  })

  it('CP-18: a newer line is said from the start, in the same bubble', async () => {
    const { rerender } = renderCompanion({ look: thinking, speech: LINE })
    await frames(talkDuration(LINE) + FRAME_MS)
    expect(frame()).toBe('thinking')

    await rerender({ speech: 'Then the latent image.' })

    expect(screen.getByRole('status')).toHaveTextContent(
      'Then the latent image.'
    )
    expect(screen.getByRole('status')).not.toHaveTextContent(LINE)
    await frames(FRAME_MS)
    expect(frame()).toBe('talk-open')
  })

  it('CP-14: with reduced motion one open-mouth frame stays for the whole line', async () => {
    preferReducedMotion()
    renderCompanion({ look: thinking, speech: LINE })

    await frames(TALK_FRAME_MS * 3)
    expect(frame()).toBe('talk-open')

    await frames(talkDuration(LINE))
    expect(frame()).toBe('thinking')
  })
})

describe('Companion: going to what the answer points at', () => {
  const pointing = { goes: 'target', pose: 'pointing' } as const

  it('CP-06: flies there delighted, lands beside the target and points the way it is', async () => {
    const { rerender } = renderCompanion()

    await rerender({ look: pointing, stand: BESIDE_TARGET, points: 'right' })
    await frames(FRAME_MS * 2)

    expect(frame()).toBe('happy')
    expect(place()).not.toBe('translate(12px, 600px)')
    expect(place()).not.toBe('translate(266px, 231px)')

    await frames(1500)

    expect(place()).toBe('translate(266px, 231px)')
    expect(frame()).toBe('point-right')
    expect(companion().dataset.docked).toBe('false')
  })

  it('CP-06: points left when she stands right of the target', async () => {
    const { rerender } = renderCompanion()

    await rerender({ look: pointing, stand: BESIDE_TARGET, points: 'left' })
    await frames(1500)

    expect(frame()).toBe('point-left')
  })

  it('CP-07: flies on to the next target', async () => {
    const { rerender } = renderCompanion({
      look: pointing,
      stand: BESIDE_TARGET
    })
    await frames(1500)

    await rerender({ stand: { x: 700, y: 120 } })
    await frames(FRAME_MS * 2)
    expect(frame()).toBe('happy')

    await frames(1500)
    expect(place()).toBe('translate(700px, 120px)')
    expect(frame()).toBe('point-right')
  })

  it('CP-08: stays where she is while there is nowhere to go yet, and does not go home', async () => {
    const { rerender } = renderCompanion({
      look: pointing,
      stand: BESIDE_TARGET
    })
    await frames(1500)

    await rerender({
      look: { goes: 'stay', pose: 'thinking' },
      stand: null
    })
    await frames(1500)

    expect(place()).toBe('translate(266px, 231px)')
    expect(frame()).toBe('thinking')
  })

  it('CP-08: does not stay delighted when the way is lost in the middle of a flight', async () => {
    const { rerender } = renderCompanion()
    await rerender({ look: pointing, stand: BESIDE_TARGET })
    await frames(FRAME_MS * 2)
    expect(frame()).toBe('happy')

    await rerender({
      look: { goes: 'stay', pose: 'thinking' },
      stand: null
    })
    await frames(FRAME_MS * 2)

    expect(frame()).toBe('thinking')
  })

  it('CP-09: follows a target that moves a little without taking off', async () => {
    const { rerender } = renderCompanion({
      look: pointing,
      stand: BESIDE_TARGET
    })
    await frames(1500)

    await rerender({ stand: { x: 280, y: 245 } })
    await frames(FRAME_MS)

    expect(frame()).toBe('point-right')
    expect(place()).not.toBe('translate(266px, 231px)')
    await frames(1000)
    expect(place()).toBe('translate(280px, 245px)')
  })

  it('CP-11: flies back to the dock, and takes clicks again once she is home', async () => {
    const { rerender } = renderCompanion({
      look: pointing,
      stand: BESIDE_TARGET
    })
    await frames(1500)

    await rerender({ look: { goes: 'dock', pose: 'resting' }, stand: null })
    await frames(FRAME_MS * 2)
    expect(frame()).toBe('happy')
    expect(button()).toHaveClass('pointer-events-none')

    await frames(1500)

    expect(place()).toBe('translate(12px, 600px)')
    expect(frame()).toBe('idle')
    expect(companion().dataset.docked).toBe('true')
    expect(button()).toHaveClass('pointer-events-auto')
  })

  it('CP-14: with reduced motion she is placed straight at the goal', async () => {
    preferReducedMotion()
    const { rerender } = renderCompanion()

    await rerender({ look: pointing, stand: BESIDE_TARGET })
    await frames(FRAME_MS * 2)

    expect(place()).toBe('translate(266px, 231px)')
    expect(frame()).toBe('point-right')
  })
})

describe('Companion: reacting to the pointer', () => {
  const thinking = { goes: 'dock', pose: 'thinking' } as const
  const pointing = { goes: 'target', pose: 'pointing' } as const
  const LONGEST_MS = Math.max(...REACTIONS.map(reactionDuration))

  const motion = () => screen.getByTestId('point-at-it-companion-motion')
  const reaction = () => companion().dataset.reaction

  function reactionNamed(id: string) {
    const found = REACTIONS.find((candidate) => candidate.id === id)
    if (!found) throw new Error(`There is no reaction called ${id}.`)
    return found
  }

  /** The roll that picks this reaction when she has done none before. */
  const rollFor = (id: string) =>
    (REACTIONS.indexOf(reactionNamed(id)) + 0.5) / REACTIONS.length
  const lengthOf = (id: string) => reactionDuration(reactionNamed(id))

  /** The pointer leaves her and comes onto her again. */
  async function enterAgain(user: ReturnType<typeof userEvent.setup>) {
    await user.unhover(button())
    await user.hover(button())
    await frames(FRAME_MS)
  }

  it('CP-33: the pointer coming onto her at rest starts a reaction, with a small movement, and she is at rest again when it is over', async () => {
    const { user } = renderCompanion({ random: () => rollFor('delighted') })
    expect(frame()).toBe('idle')
    expect(reaction()).toBeUndefined()

    await user.hover(button())
    await frames(FRAME_MS)

    expect(frame()).toBe('happy')
    expect(reaction()).toBe('delighted')
    expect(motion()).toHaveAttribute('data-motion', 'hop')

    await frames(lengthOf('delighted'))

    expect(frame()).toBe('idle')
    expect(reaction()).toBeUndefined()
    expect(motion()).not.toHaveAttribute('data-motion')
  })

  it.for(REACTIONS)(
    'CP-33: the roll that picks $id shows it: its frame and its movement',
    async (picked) => {
      const { user } = renderCompanion({ random: () => rollFor(picked.id) })

      await user.hover(button())
      await frames(FRAME_MS)

      expect(reaction()).toBe(picked.id)
      expect(frame()).toBe(picked.beats[0].frame)
      expect(motion()).toHaveAttribute('data-motion', picked.motion)
      expect(motion().style.getPropertyValue('--companion-reaction-ms')).toBe(
        `${reactionDuration(picked)}ms`
      )
    }
  )

  it('CP-33: a reaction with several frames goes through them, then back to idle', async () => {
    const { user } = renderCompanion({ random: () => rollFor('giggle') })

    await user.hover(button())
    const seen = new Set<string | undefined>()
    for (let ms = 0; ms < lengthOf('giggle') + FRAME_MS * 2; ms += FRAME_MS) {
      await frames(FRAME_MS)
      seen.add(frame())
    }

    expect(seen).toEqual(new Set(['talk-wide', 'talk-open', 'idle']))
  })

  it('CP-33: leaving her neither cuts a reaction short nor leaves her stuck: it plays out and she is at rest', async () => {
    const { user } = renderCompanion({ random: () => rollFor('delighted') })
    await user.hover(button())
    await frames(FRAME_MS)

    await user.unhover(button())
    await frames(FRAME_MS * 2)
    expect(frame()).toBe('happy')

    await frames(lengthOf('delighted'))
    expect(frame()).toBe('idle')
  })

  it('CP-33: with the pointer still on her when it is over she stays at rest, and does not start another', async () => {
    const { user } = renderCompanion({ random: () => rollFor('oh') })
    await user.hover(button())

    await frames(lengthOf('oh') + REACTION_COOLDOWN_MS * 3)

    expect(frame()).toBe('idle')
    expect(reaction()).toBeUndefined()
  })

  it('CP-34: she never does the same reaction twice in a row, even when the roll is always the same', async () => {
    const { user } = renderCompanion({ random: () => 0 })
    const done: (string | undefined)[] = []

    for (let time = 0; time < 5; time++) {
      await user.hover(button())
      await frames(FRAME_MS)
      done.push(reaction())
      await frames(LONGEST_MS + REACTION_COOLDOWN_MS)
      await user.unhover(button())
    }

    expect(done).not.toContain(undefined)
    expect(new Set(done).size).toBeGreaterThan(1)
    done.slice(1).forEach((id, index) => expect(id).not.toBe(done[index]))
  })

  it('CP-35: waggling the pointer neither restarts a reaction nor starts one in the pause after it, and she reacts again once the pause is over', async () => {
    const { user } = renderCompanion({ random: () => rollFor('oh') })
    await user.hover(button())
    await frames(100)

    await enterAgain(user)
    expect(reaction()).toBe('oh')
    await frames(lengthOf('oh') - 100 + FRAME_MS)
    expect(reaction()).toBeUndefined()
    expect(frame()).toBe('idle')

    await enterAgain(user)
    expect(reaction()).toBeUndefined()

    await frames(REACTION_COOLDOWN_MS)
    await enterAgain(user)
    expect(reaction()).toBeDefined()
  })

  it('CP-36: she does not react beside what she points at, and keeps pointing', async () => {
    const { user } = renderCompanion({
      random: () => rollFor('oh'),
      look: pointing,
      stand: BESIDE_TARGET
    })
    await frames(1500)

    await user.hover(button())
    await frames(FRAME_MS * 4)

    expect(frame()).toBe('point-right')
    expect(reaction()).toBeUndefined()
  })

  it('CP-36: she does not react while she flies, and the pointer does not make her react once she has landed', async () => {
    const { user, rerender } = renderCompanion({
      random: () => rollFor('oh')
    })
    await rerender({ look: pointing, stand: BESIDE_TARGET })
    await frames(FRAME_MS * 2)
    expect(frame()).toBe('happy')

    await user.hover(button())
    await frames(FRAME_MS * 2)
    expect(frame()).toBe('happy')
    expect(reaction()).toBeUndefined()

    await frames(1500)
    expect(frame()).toBe('point-right')
    expect(reaction()).toBeUndefined()
  })

  it('CP-36: she does not react while she thinks or says a line, and shows only what that shows', async () => {
    const { user } = renderCompanion({
      random: () => rollFor('delighted'),
      look: thinking,
      speech: LINE
    })
    await user.hover(button())
    await frames(FRAME_MS)
    expect(frame()).toBe('talk-open')
    expect(reaction()).toBeUndefined()

    await frames(talkDuration(LINE))
    expect(frame()).toBe('thinking')
    expect(reaction()).toBeUndefined()
  })

  it('CP-36: a reaction stops when she has something else to do, and does not pick up again when she is back at rest', async () => {
    const { user, rerender } = renderCompanion({
      random: () => rollFor('delighted')
    })
    await user.hover(button())
    await frames(100)
    expect(reaction()).toBe('delighted')

    await rerender({ look: thinking })
    expect(frame()).toBe('thinking')
    expect(reaction()).toBeUndefined()
    expect(motion()).not.toHaveAttribute('data-motion')

    await frames(FRAME_MS * 4)
    await rerender({ look: { goes: 'dock', pose: 'resting' } })
    await frames(FRAME_MS * 2)
    expect(frame()).toBe('idle')
    expect(reaction()).toBeUndefined()
  })

  it('CP-37: a click on her presses as before, in a reaction or not, and she stays the same button', async () => {
    const { user, emitted } = renderCompanion({
      random: () => rollFor('curious'),
      accessibleAs: { name: 'Ask', pressed: false }
    })

    await user.click(button())
    await frames(FRAME_MS)
    expect(reaction()).toBe('curious')
    expect(emitted('press')).toHaveLength(1)

    await user.click(button())
    await frames(LONGEST_MS)
    await user.click(button())

    expect(emitted('press')).toHaveLength(3)
    const ask = screen.getByRole('button', { name: 'Ask' })
    expect(ask).toBe(button())
    expect(ask).toBeEnabled()
    expect(ask).toHaveAttribute('aria-pressed', 'false')
    expect(ask).toHaveAttribute('title', 'Ask the agent')
  })

  it('CP-38: with reduced motion a reaction is one still frame, and she does not move', async () => {
    preferReducedMotion()
    const { user } = renderCompanion({ random: () => rollFor('giggle') })

    await user.hover(button())
    const seen = new Set<string | undefined>()
    for (let ms = 0; ms < lengthOf('giggle') - 100; ms += FRAME_MS) {
      await frames(FRAME_MS)
      seen.add(frame())
      expect(motion()).not.toHaveAttribute('data-motion')
    }

    expect(seen).toEqual(new Set(['talk-wide']))
    expect(reaction()).toBe('giggle')

    await frames(200)
    expect(frame()).toBe('idle')
    expect(reaction()).toBeUndefined()
  })

  it('CP-39: with reactions off she does not react', async () => {
    const { user } = renderCompanion({
      random: () => rollFor('delighted'),
      reacts: false
    })

    await user.hover(button())
    await frames(FRAME_MS * 4)

    expect(frame()).toBe('idle')
    expect(reaction()).toBeUndefined()
    expect(motion()).not.toHaveAttribute('data-motion')
  })

  it('CP-39: while she cannot be pressed she does not react, in any browser, and does once she can', async () => {
    const { user, rerender } = renderCompanion({
      random: () => rollFor('delighted'),
      disabled: true
    })

    await user.hover(button())
    await frames(FRAME_MS * 4)
    expect(button()).toBeDisabled()
    expect(reaction()).toBeUndefined()

    await rerender({ disabled: false })
    await enterAgain(user)
    expect(reaction()).toBe('delighted')
  })
})

describe('Companion: telling the layer where the pointer is', () => {
  const awayFromHome = { goes: 'target', pose: 'pointing' } as const

  it('CP-67: tells the layer when a pointer comes onto her and when it leaves, and which kind of pointer it is', async () => {
    const { user, emitted } = renderCompanion()

    await user.hover(button())
    expect(emitted('enter')).toEqual([['mouse']])
    expect(emitted()).not.toHaveProperty('leave')

    await user.unhover(button())
    expect(emitted('leave')).toHaveLength(1)
  })

  it('CP-73: tells a touch pointer as touch', async () => {
    const { emitted } = renderCompanion()

    // oxlint-disable-next-line testing-library/prefer-user-event -- user-event cannot set the pointer type
    await fireEvent.pointerEnter(button(), { pointerType: 'touch' })

    expect(emitted('enter')).toEqual([['touch']])
  })

  it('CP-74: tells nothing about a pointer coming onto her while she cannot be pressed or is away from the dock, even from a browser that tells a disabled button', async () => {
    const { emitted, rerender } = renderCompanion({ disabled: true })

    // oxlint-disable-next-line testing-library/prefer-user-event -- user-event cannot set the pointer type
    await fireEvent.pointerEnter(button(), { pointerType: 'mouse' })
    expect(emitted()).not.toHaveProperty('enter')

    await rerender({
      disabled: false,
      look: awayFromHome,
      stand: BESIDE_TARGET
    })
    await frames(FRAME_MS * 2)
    // oxlint-disable-next-line testing-library/prefer-user-event -- user-event cannot set the pointer type
    await fireEvent.pointerEnter(button(), { pointerType: 'mouse' })

    expect(emitted()).not.toHaveProperty('enter')
  })

  it('CP-75: has a tooltip only when she is given one, and is the same named button without it', async () => {
    const { rerender } = renderCompanion({
      title: 'Ask the agent',
      accessibleAs: { name: 'Ask me anything', expanded: false }
    })
    expect(button()).toHaveAttribute('title', 'Ask the agent')

    await rerender({ title: undefined })

    expect(button()).not.toHaveAttribute('title')
    expect(
      screen.getByRole('button', { name: 'Ask me anything', expanded: false })
    ).toBe(button())
  })
})
