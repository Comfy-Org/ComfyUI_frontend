import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MoveAnythingStudio from './MoveAnythingStudio.vue'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

function screenIsWide(wide: boolean) {
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches: wide,
    media,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
  }))
}

async function openPanelExample() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(MoveAnythingStudio)
  await user.click(screen.getByRole('button', { name: 'Try the example' }))
  return user
}

const panel = () =>
  screen.getByRole('complementary', { name: 'Move anything settings' })

function stageAt1000x600() {
  const stage = screen.getByTestId('move-stage')
  vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 600)
  )
  return stage
}

async function smartSelectKitten(user: ReturnType<typeof userEvent.setup>) {
  const stage = stageAt1000x600()
  await user.pointer({
    keys: '[MouseLeft]',
    target: stage,
    coords: { clientX: 200, clientY: 300 }
  })
  expect(screen.getByRole('status')).toHaveTextContent('Detecting…')
  await vi.advanceTimersByTimeAsync(600)
  return screen.getByRole('button', { name: /^Orange kitten\./ })
}

describe('MoveAnythingStudio', () => {
  it('moves a thing in the example, waits, then offers the result', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(MoveAnythingStudio, { props: { layout: 'e' } })
    expect(screen.queryByTestId('move-generate')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Try the example' }))
    const generate = screen.getByTestId('move-generate')
    expect(generate).toBeDisabled()
    ;(await smartSelectKitten(user)).focus()
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(generate).toHaveTextContent('Move 1 object')
    expect(screen.getByTestId('move-ghost')).toBeInTheDocument()

    await user.click(generate)
    expect(screen.getByRole('status')).toHaveTextContent('Making the move')
    await vi.runAllTimersAsync()

    expect(
      await screen.findByRole('link', { name: 'Download' })
    ).toHaveAttribute('href', '/images/apps/move-anything/example-moved.jpg')
  })

  it('lists the selected things in the Objects tray and removes one', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(MoveAnythingStudio, { props: { layout: 'e' } })
    await user.click(screen.getByRole('button', { name: 'Try the example' }))
    await smartSelectKitten(user)

    await user.click(screen.getByRole('button', { name: /Objects/ }))
    const tray = screen.getByRole('dialog', { name: 'Objects' })
    expect(tray).toHaveTextContent('1 of 4')
    await user.click(
      screen.getByRole('button', { name: 'Remove Orange kitten' })
    )

    expect(tray).toHaveTextContent('0 of 4')
    expect(
      screen.queryByRole('button', { name: /^Orange kitten\./ })
    ).toBeNull()
  })
  it('undoes and redoes a move from the history controls above the photo', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(MoveAnythingStudio, { props: { layout: 'e' } })
    await user.click(screen.getByRole('button', { name: 'Try the example' }))
    const history = screen.getByRole('group', { name: 'History' })
    const generate = screen.getByTestId('move-generate')

    ;(await smartSelectKitten(user)).focus()
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    await user.click(within(history).getByRole('button', { name: 'Undo' }))
    expect(generate).toBeDisabled()

    await user.click(within(history).getByRole('button', { name: 'Redo' }))
    expect(generate).toHaveTextContent('Move 1 object')
  })
  it('shows the how-to hint on the photo until a thing is touched', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(MoveAnythingStudio, { props: { layout: 'e' } })
    await user.click(screen.getByRole('button', { name: 'Try the example' }))
    const hint = /^Drag to move/

    expect(screen.getByText('Click a thing to select it')).toBeInTheDocument()
    const kitten = await smartSelectKitten(user)
    expect(screen.getByText(hint)).toBeInTheDocument()
    kitten.focus()
    await user.keyboard('{ArrowRight}')

    expect(screen.queryByText(hint)).toBeNull()
  })

  it('moves a thing from the side panel layout, with its tools floating over the photo', async () => {
    screenIsWide(true)
    const user = await openPanelExample()
    expect(panel()).toHaveTextContent('kitten.jpg')
    expect(panel()).toHaveTextContent('1043 × 693')
    const tools = screen.getByRole('toolbar', { name: 'Move anything tools' })
    expect(
      within(tools).getByRole('group', { name: 'History' })
    ).toContainElement(screen.getByRole('button', { name: 'Undo' }))
    expect(
      within(tools).getByRole('button', { name: 'Smart select' })
    ).toHaveAttribute('aria-pressed', 'true')
    const generate = within(panel()).getByTestId('move-generate')
    expect(generate).toBeDisabled()

    const kitten = await smartSelectKitten(user)
    expect(within(tools).getByRole('button', { name: 'Move' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByTestId('move-outline')).toBeInTheDocument()
    kitten.focus()
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(
      within(panel()).getByRole('list', { name: 'Objects' })
    ).toHaveTextContent('Moved')
    await user.click(
      within(panel()).getByRole('radio', { name: 'Best · 1 min' })
    )
    expect(
      within(panel()).getByRole('radio', { name: 'Best · 1 min' })
    ).toBeChecked()
    await user.click(generate)
    expect(screen.getByRole('status')).toHaveTextContent('About a minute')
    await vi.advanceTimersByTimeAsync(3000)

    expect(
      await screen.findByRole('link', { name: 'Download' })
    ).toHaveAttribute('href', '/images/apps/move-anything/example-moved.jpg')
  })

  it('snaps a box drawn with Box select to the succulent it surrounds', async () => {
    screenIsWide(true)
    const user = await openPanelExample()
    await user.click(screen.getByRole('button', { name: 'Box select' }))
    expect(screen.getByText('Draw a box around a thing')).toBeInTheDocument()
    const stage = stageAt1000x600()

    await user.pointer([
      {
        keys: '[MouseLeft>]',
        target: stage,
        coords: { clientX: 280, clientY: 318 }
      },
      { target: stage, coords: { clientX: 430, clientY: 468 } },
      { keys: '[/MouseLeft]', target: stage }
    ])

    expect(panel()).toHaveTextContent('1 of 4')
    expect(
      within(panel()).getByRole('list', { name: 'Objects' })
    ).toHaveTextContent('Succulent')
  })

  it('renames a thing inline in the Objects list, and undoes it', async () => {
    screenIsWide(true)
    const user = await openPanelExample()
    await smartSelectKitten(user)

    await user.click(
      within(panel()).getByRole('button', { name: 'Rename Orange kitten' })
    )
    const field = within(panel()).getByRole('textbox', {
      name: 'Rename Orange kitten'
    })
    await user.clear(field)
    await user.type(field, 'Ginger{Enter}')

    expect(screen.getByRole('button', { name: /^Ginger\./ })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(
      screen.getByRole('button', { name: /^Orange kitten\./ })
    ).toBeVisible()
  })

  it('keeps the scene description and seed under Advanced', async () => {
    screenIsWide(true)
    const user = await openPanelExample()
    expect(
      within(panel()).queryByRole('spinbutton', { name: 'Seed' })
    ).toBeNull()

    await user.click(within(panel()).getByRole('button', { name: /^Advanced/ }))

    expect(
      within(panel()).getByRole('spinbutton', { name: 'Seed' })
    ).toHaveValue(42)
    expect(
      within(panel()).getByRole('textbox', {
        name: 'Describe the scene (optional)'
      })
    ).toHaveValue('')
  })

  it('opens on phones as a sheet with a one-line summary and the run button', async () => {
    screenIsWide(false)
    const user = await openPanelExample()
    const summary = within(panel()).getByRole('button', {
      name: '0 objects · 0 moved · Fast'
    })
    expect(within(panel()).getByTestId('move-generate')).toBeDisabled()
    expect(within(panel()).queryByText(/^Nothing selected yet/)).toBeNull()
    expect(
      within(panel()).getByRole('toolbar', { name: 'Move anything tools' })
    ).toBeVisible()

    await user.click(summary)

    expect(within(panel()).getByText(/^Nothing selected yet/)).toBeVisible()
    expect(
      within(panel()).getByRole('button', { name: 'Hide settings' })
    ).toHaveAttribute('aria-expanded', 'true')
  })
})
