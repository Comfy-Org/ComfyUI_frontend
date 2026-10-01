import { fireEvent, render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import RelightStudio from './RelightStudio.vue'

vi.mock(import('../../../lib/workshop/relight/render-image'), () => ({
  renderRelitImage: vi.fn(() => Promise.resolve(undefined))
}))

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

async function openExample(layout?: string) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(RelightStudio, { props: { layout } })
  await user.click(screen.getByRole('button', { name: 'Try the example' }))
  return user
}

const panel = () =>
  screen.getByRole('complementary', { name: 'Relight settings' })
const section = (name: string) => within(panel()).getByRole('region', { name })
const undo = () => screen.getByRole('button', { name: 'Undo' })

describe('RelightStudio', () => {
  it('relights from the side panel: pick a light, change it, then get the result', async () => {
    const user = await openExample()
    expect(undo()).toBeDisabled()
    const lights = section('Lights')

    await user.click(within(lights).getByRole('button', { name: /^Cool fill/ }))
    const intensity = within(lights).getByRole('slider', { name: 'Intensity' })
    expect(intensity).toHaveValue('30')
    await fireEvent.update(intensity, '65')
    expect(undo()).toBeEnabled()

    await user.click(within(panel()).getByTestId('relight-run'))
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Relighting…')
    expect(status).toHaveTextContent('0:00 · 2 lights')
    expect(
      within(panel()).getByRole('button', { name: 'Cancel' })
    ).toBeVisible()
    await vi.advanceTimersByTimeAsync(3000)

    expect(
      await screen.findByRole('link', { name: 'Download' })
    ).toHaveAttribute('href', '/images/apps/relight/example-relit.jpg')
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('selects a light from its handle and highlights it in the list', async () => {
    const user = await openExample()
    const dot = screen.getByRole('button', { name: /^Cool fill\./ })
    expect(dot).toHaveAttribute('aria-pressed', 'false')

    await user.click(dot)

    expect(dot).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(section('Lights')).getByRole('button', { name: /^Cool fill/ })
    ).toHaveAttribute('aria-pressed', 'true')
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}')
    expect(parseFloat(dot.style.left)).toBeCloseTo(80)
  })

  it('shows directional controls only for a directional light', async () => {
    const user = await openExample()
    const lights = section('Lights')
    expect(
      within(lights).getByRole('slider', { name: 'Direction' })
    ).toBeVisible()
    expect(
      within(lights).queryByRole('slider', { name: 'Softness' })
    ).toBeNull()

    await user.click(within(lights).getByRole('radio', { name: 'Point' }))

    expect(
      within(lights).queryByRole('slider', { name: 'Direction' })
    ).toBeNull()
    expect(
      within(lights).getByRole('slider', { name: 'Softness' })
    ).toBeVisible()
  })

  it('duplicates, hides and deletes lights from the list, and undoes', async () => {
    const user = await openExample()
    const lights = section('Lights')
    const rows = () =>
      within(within(lights).getByRole('list', { name: 'Lights' }))
        .getAllByRole('listitem')
        .map((row) => row.textContent.trim())

    await user.click(
      within(lights).getByRole('button', { name: 'Duplicate Warm key' })
    )
    await user.click(
      within(lights).getByRole('button', { name: 'Delete Cool fill' })
    )
    expect(rows()).toEqual([
      expect.stringContaining('Warm key'),
      expect.stringContaining('Warm key copy')
    ])
    await user.click(
      within(lights).getByRole('button', { name: 'Hide Warm key' })
    )
    expect(
      within(lights).getByRole('button', { name: 'Show Warm key' })
    ).toBeVisible()

    await user.click(undo())
    await user.click(undo())
    expect(rows()).toHaveLength(3)
  })

  it.for([
    { view: 'Original', preview: false },
    { view: 'Light map', preview: true },
    { view: 'Live lighting', preview: true }
  ])('shows the live preview on $view: $preview', async ({ view, preview }) => {
    const user = await openExample()

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'View' }),
      view
    )

    const shown = screen.getByTestId('relight-preview')
    if (preview) expect(shown).toBeVisible()
    else expect(shown).not.toBeVisible()
  })

  it('hides the light handles', async () => {
    const user = await openExample()
    expect(screen.getByRole('button', { name: /^Warm key\./ })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Light handles' }))

    expect(screen.queryByRole('button', { name: /^Warm key\./ })).toBeNull()
  })

  it('creates a mask for the chosen light and draws it on the photo', async () => {
    const user = await openExample()
    const masks = section('Masks')
    await user.selectOptions(
      within(masks).getByRole('combobox', { name: 'Apply to' }),
      'Cool fill'
    )
    const area = within(masks).getByRole('radiogroup', {
      name: 'Where Cool fill shines'
    })
    expect(
      within(area).getByRole('radio', { name: 'Whole image' })
    ).toBeChecked()

    await user.type(
      within(masks).getByRole('textbox', { name: 'Subject' }),
      'sky'
    )
    await user.click(within(masks).getByRole('button', { name: 'Create mask' }))

    expect(within(area).getByRole('radio', { name: 'sky' })).toBeChecked()
    expect(screen.queryByTestId('relight-mask')).toBeNull()
    await user.click(
      within(masks).getByRole('button', { name: 'Show sky on the photo' })
    )
    expect(screen.getByTestId('relight-mask')).toHaveTextContent('sky')
  })

  it('cancels a relight from the photo', async () => {
    const user = await openExample()
    await user.click(within(panel()).getByTestId('relight-run'))

    await user.click(
      within(screen.getByRole('status')).getByRole('button', { name: 'Cancel' })
    )

    expect(screen.queryByRole('status')).toBeNull()
    expect(
      within(section('Lights')).getByRole('slider', { name: 'Intensity' })
    ).toBeEnabled()
  })

  it('shows the how-to hint on the photo until a light is touched', async () => {
    const user = await openExample()
    const hint = 'Drag a light to move it · Arrow keys to nudge'
    expect(screen.getByTestId('relight-stage')).toHaveTextContent(hint)

    await user.click(screen.getByRole('button', { name: /^Cool fill\./ }))

    expect(screen.queryByText(hint)).toBeNull()
  })

  it('keeps the bottom dock and its trays in the bottom composer layout', async () => {
    const user = await openExample('e')
    expect(screen.queryByRole('complementary')).toBeNull()

    await user.click(screen.getByRole('button', { name: /Lights/ }))
    const tray = screen.getByRole('dialog', { name: 'Lights' })
    expect(tray).toHaveTextContent('2 of 4')
    const intensity = within(tray).getByRole('slider', { name: 'Intensity' })
    await fireEvent.update(intensity, '35')

    expect(intensity).toHaveValue('35')
    expect(undo()).toBeEnabled()
    expect(
      screen.getByRole('toolbar', { name: 'Relight tools' })
    ).toContainElement(screen.getByTestId('relight-run'))
  })
})
