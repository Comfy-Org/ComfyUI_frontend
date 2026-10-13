import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import type { DarkroomReference } from '@/lib/darkroom/feed'
import type { StudioGate } from '@/lib/workshop/cinematic-studio/gate'

import DarkroomPromptBar from './DarkroomPromptBar.vue'

vi.mock(import('@/config/workshop-session-state'))
vi.mock(import('@/scripts/posthog'))

const HISTORY = ['a lighthouse at dusk', 'a fox reading a map']

function mount(
  options: {
    gate?: StudioGate
    references?: DarkroomReference[]
    boardName?: string
    start?: string
  } = {}
) {
  const prompt = ref(options.start ?? '')
  const events: Record<string, unknown[][]> = {}
  const record =
    (name: string) =>
    (...args: unknown[]) =>
      (events[name] ??= []).push(args)
  render(
    defineComponent({
      setup: () => () =>
        h(DarkroomPromptBar, {
          modelValue: prompt.value,
          'onUpdate:modelValue': (value: string) => (prompt.value = value),
          gate: options.gate ?? 'ready',
          references: options.references ?? [],
          history: HISTORY,
          boardName: options.boardName,
          summary: 'Nano Banana 2.1 · Wide · 4 images',
          settingsOpen: false,
          onGenerate: record('generate'),
          onFiles: record('files'),
          onRemoveReference: record('removeReference'),
          onClearReferences: record('clearReferences'),
          onToggleSettings: record('toggleSettings'),
          onMoodboard: record('moodboard')
        })
    })
  )
  return { prompt, events, box: screen.getByTestId('darkroom-prompt') }
}

describe('DarkroomPromptBar', () => {
  it('generates on Enter and leaves Shift+Enter for a new line', async () => {
    const { events, box } = mount({ start: 'a fox' })

    await userEvent.type(box, '{Shift>}{Enter}{/Shift}')
    expect(events.generate).toBeUndefined()

    await userEvent.type(box, '{Enter}')
    expect(events.generate).toHaveLength(1)
  })

  it('waits for an input method to finish before generating', async () => {
    const { events, box } = mount({ start: 'きつね' })
    box.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: true,
        bubbles: true
      })
    )
    expect(events.generate).toBeUndefined()
  })

  it('steps through earlier prompts with ↑ and ↓', async () => {
    const { prompt, box } = mount()

    await userEvent.type(box, '{ArrowUp}')
    expect(prompt.value).toBe('a lighthouse at dusk')
    await userEvent.type(box, '{ArrowUp}')
    expect(prompt.value).toBe('a fox reading a map')
    await userEvent.type(box, '{ArrowDown}')
    await userEvent.type(box, '{ArrowDown}')
    expect(prompt.value).toBe('')
  })

  it('leaves the arrows alone while something is being typed', async () => {
    const { prompt, box } = mount({ start: 'a draft' })
    await userEvent.type(box, '{ArrowUp}')
    expect(prompt.value).toBe('a draft')
  })

  it('numbers the references and lets each be removed', async () => {
    const reference = {
      name: 'jacket.png',
      mime: 'image/png',
      data: 'AAAA',
      url: 'data:image/png;base64,AAAA'
    }
    const { events } = mount({ references: [reference, reference] })

    expect(screen.getByAltText('Reference 2')).toBeTruthy()
    expect(
      screen.getByText(
        'Refer to them by number, like “the jacket from image 2”.'
      )
    ).toBeTruthy()

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove image 2' })
    )
    await userEvent.click(screen.getByRole('button', { name: 'Remove all' }))

    expect(events.removeReference).toEqual([[1]])
    expect(events.clearReferences).toHaveLength(1)
  })

  it('shows the moodboard new images follow, and opens its menu', async () => {
    const { events } = mount({ boardName: 'Dusk' })
    const button = screen.getByTestId('darkroom-moodboard-button')

    expect(button.textContent).toContain('Dusk')
    await userEvent.click(button)

    expect(events.moodboard[0][0]).toBe(button)
  })

  it('offers sign-in in place of Generate to a visitor', () => {
    mount({ gate: 'signedOut' })

    expect(screen.getByRole('link', { name: /^Sign in/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Generate' })).toBeNull()
  })
})
