import { fireEvent, render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import RelightStudio from './RelightStudio.vue'

vi.mock(import('../../../lib/workshop/relight/render-image'), () => ({
  renderRelitImage: vi.fn(() => Promise.resolve(undefined)),
  renderMoodThumbnails: vi.fn(() => Promise.resolve(undefined))
}))

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

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  screenIsWide(true)
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
const lightNames = () =>
  within(section('Lights'))
    .getAllByRole('tab')
    .map((tab) => tab.textContent.trim())
const lightTab = (name: RegExp) =>
  within(section('Lights')).getByRole('tab', { name })

async function fineTune(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    within(section('Lights')).getByRole('button', { name: 'Fine-tune' })
  )
}

async function lightAction(
  user: ReturnType<typeof userEvent.setup>,
  light: string,
  action: string
) {
  await user.click(lightTab(new RegExp(`^${light}\\s*(Point|Directional)$`)))
  await user.click(
    within(section('Lights')).getByRole('button', { name: `More for ${light}` })
  )
  await user.click(
    within(section('Lights')).getByRole('menuitem', {
      name: `${action} ${light}`
    })
  )
}

describe('RelightStudio', () => {
  it('relights from the floating panel: pick a light, change it, then get the result', async () => {
    const user = await openExample()
    expect(undo()).toBeDisabled()
    const lights = section('Lights')

    await user.click(lightTab(/^Cool fill/))
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

  it('selects a light from its handle and shows its controls under the tabs', async () => {
    const user = await openExample()
    const dot = screen.getByRole('button', { name: /^Cool fill\./ })
    expect(dot).toHaveAttribute('aria-pressed', 'false')

    await user.click(dot)

    expect(dot).toHaveAttribute('aria-pressed', 'true')
    expect(lightTab(/^Cool fill/)).toHaveAttribute('aria-selected', 'true')
    expect(
      within(section('Lights')).getByRole('tabpanel', { name: /^Cool fill/ })
    ).toBe(screen.getByTestId('relight-light-editor'))
    dot.focus()
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}')
    expect(parseFloat(dot.style.left)).toBeCloseTo(85)
  })

  it('moves between light tabs with the arrow keys', async () => {
    const user = await openExample()
    lightTab(/^Warm key/).focus()

    await user.keyboard('{ArrowRight}')

    expect(lightTab(/^Cool fill/)).toHaveAttribute('aria-selected', 'true')
    expect(lightTab(/^Cool fill/)).toHaveFocus()
  })

  it('shows the orbit only for a directional light, and Softness for a point light', async () => {
    const user = await openExample()
    const lights = section('Lights')
    expect(
      within(lights).getByRole('group', { name: 'Light position' })
    ).toBeVisible()
    expect(
      within(lights).queryByRole('slider', { name: 'Direction' })
    ).toBeNull()
    expect(
      within(lights).queryByRole('slider', { name: 'Softness' })
    ).toBeNull()

    await user.click(within(lights).getByRole('radio', { name: 'Point' }))

    expect(
      within(lights).queryByRole('group', { name: 'Light position' })
    ).toBeNull()
    expect(
      within(lights).queryByRole('button', { name: 'Fine-tune' })
    ).toBeNull()
    expect(
      within(lights).getByRole('slider', { name: 'Softness' })
    ).toBeVisible()
  })

  it('places a directional light from the orbit presets and handles', async () => {
    const user = await openExample()
    const lights = section('Lights')
    await fineTune(user)
    const elevation = within(lights).getByRole('slider', { name: 'Elevation' })

    await user.click(within(lights).getByRole('button', { name: 'Top' }))

    expect(screen.getByTestId('relight-orbit-readout')).toHaveTextContent(
      '90° · 20°'
    )
    expect(
      within(lights).getByRole('slider', { name: 'Direction' })
    ).toHaveValue('90')
    expect(elevation).toHaveValue('20')
    expect(within(lights).getByRole('button', { name: 'Top' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    within(lights).getByRole('slider', { name: 'Height' }).focus()
    await user.keyboard('{ArrowDown}')
    expect(elevation).not.toHaveValue('20')
    await user.click(undo())
    expect(elevation).toHaveValue('20')
  })

  it('adds a directional light from the floating Add light menu and selects it', async () => {
    const user = await openExample()
    const lights = section('Lights')

    const tools = screen.getByRole('toolbar', { name: 'Relight tools' })
    expect(
      within(tools).getByRole('group', { name: 'History' })
    ).toContainElement(undo())
    await user.click(within(tools).getByRole('button', { name: 'Add light' }))
    await user.click(
      within(tools).getByRole('menuitem', { name: 'Directional' })
    )

    expect(lightNames()).toEqual([
      expect.stringContaining('Warm key'),
      expect.stringContaining('Cool fill'),
      expect.stringContaining('Light 3')
    ])
    expect(lightTab(/^Light 3/)).toHaveAttribute('aria-selected', 'true')
    expect(
      within(lights).getByRole('group', { name: 'Light position' })
    ).toBeVisible()
    expect(within(tools).queryByRole('menu')).toBeNull()
  })

  it('duplicates, hides and deletes lights from their menus, and undoes', async () => {
    const user = await openExample()

    await lightAction(user, 'Warm key', 'Duplicate')
    await lightAction(user, 'Cool fill', 'Delete')
    expect(lightNames()).toEqual([
      expect.stringContaining('Warm key'),
      expect.stringContaining('Warm key copy')
    ])
    await lightAction(user, 'Warm key', 'Hide')
    await user.click(
      within(section('Lights')).getByRole('button', {
        name: 'More for Warm key'
      })
    )
    expect(
      within(section('Lights')).getByRole('menuitem', { name: 'Show Warm key' })
    ).toBeVisible()

    await user.click(undo())
    await user.click(undo())
    expect(lightNames()).toHaveLength(3)
  })

  it('picks a mood from its tile, replacing the lights, and undoes it', async () => {
    const user = await openExample()
    const moods = within(section('Mood')).getByRole('radiogroup', {
      name: 'Mood'
    })
    expect(within(moods).getByRole('radio', { name: 'Sunset' })).toBeChecked()

    await user.click(within(moods).getByRole('radio', { name: 'Neon' }))

    expect(within(moods).getByRole('radio', { name: 'Neon' })).toBeChecked()
    expect(lightNames()).toEqual([
      expect.stringContaining('Pink neon'),
      expect.stringContaining('Blue neon')
    ])
    await user.click(undo())
    expect(within(moods).getByRole('radio', { name: 'Sunset' })).toBeChecked()
  })

  it.for([
    { look: 'None', castShadows: 'false', elevation: '15' },
    { look: 'Hard', castShadows: 'true', elevation: '35' },
    { look: 'Soft', castShadows: 'true', elevation: '35' }
  ])(
    'sets every light to $look shadows from the tiles',
    async ({ look, castShadows, elevation }) => {
      const user = await openExample()
      await user.click(
        within(panel()).getByRole('button', { name: /^Shadows/ })
      )
      const shadows = within(section('Shadows')).getByRole('radiogroup', {
        name: 'Shadows'
      })
      expect(within(shadows).getByRole('radio', { name: 'Long' })).toBeChecked()

      await user.click(within(shadows).getByRole('radio', { name: look }))

      expect(within(shadows).getByRole('radio', { name: look })).toBeChecked()
      const lights = section('Lights')
      await fineTune(user)
      expect(
        within(lights).getByRole('switch', { name: 'Cast shadows' })
      ).toHaveAttribute('aria-checked', castShadows)
      expect(
        within(lights).getByRole('slider', { name: 'Elevation' })
      ).toHaveValue(elevation)
    }
  )

  it('splits the photo into original and relit while Compare is on', async () => {
    const user = await openExample()
    const tools = screen.getByRole('toolbar', { name: 'Relight tools' })
    const compare = within(tools).getByRole('button', { name: 'Compare' })
    const stage = screen.getByTestId('relight-stage')

    await user.click(compare)

    expect(compare).toHaveAttribute('aria-pressed', 'true')
    const divider = within(stage).getByRole('slider', {
      name: 'Drag to compare the original and the live preview'
    })
    expect(divider).toHaveValue('50')
    expect(stage).toHaveTextContent('Original')
    expect(stage).toHaveTextContent('Relit')
    expect(screen.queryByRole('button', { name: /^Warm key\./ })).toBeNull()
    expect(
      screen.queryByText('Drag a light to move it · Arrow keys to nudge')
    ).toBeNull()
    await fireEvent.update(divider, '60')
    expect(within(stage).getByTestId('relight-preview')).toHaveStyle({
      clipPath: 'inset(0 0 0 60%)'
    })

    await user.click(compare)
    expect(within(stage).queryByRole('slider')).toBeNull()
    expect(screen.getByRole('button', { name: /^Warm key\./ })).toBeVisible()
  })

  it('shows the light map from the Scene section', async () => {
    const user = await openExample()
    await user.click(within(panel()).getByRole('button', { name: /^Scene/ }))
    const toggle = within(section('Scene')).getByRole('switch', {
      name: 'Show light map'
    })

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(
      within(screen.getByTestId('relight-stage')).getByTestId('relight-preview')
    ).toBeVisible()
  })

  it('hides the light handles', async () => {
    const user = await openExample()
    expect(screen.getByRole('button', { name: /^Warm key\./ })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Light handles' }))

    expect(screen.queryByRole('button', { name: /^Warm key\./ })).toBeNull()
  })

  it('opens the collapsed Masks section, creates a mask and draws it', async () => {
    const user = await openExample()
    expect(
      within(panel()).queryByRole('combobox', { name: 'Apply to' })
    ).toBeNull()
    await user.click(within(panel()).getByRole('button', { name: /^Masks/ }))
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

  it('opens on phones as a sheet with a one-line summary and the run button, and expands', async () => {
    screenIsWide(false)
    const user = await openExample()
    expect(
      within(panel()).getByRole('button', { name: 'Sunset · 2 lights · Long' })
    ).toHaveAttribute('aria-expanded', 'false')
    expect(within(panel()).getByTestId('relight-run')).toBeEnabled()
    expect(within(panel()).queryByRole('region', { name: 'Lights' })).toBeNull()

    await user.click(
      within(panel()).getByRole('button', { name: 'Show all settings' })
    )

    expect(section('Lights')).toBeVisible()
    expect(
      within(panel()).getByRole('button', { name: 'Hide settings' })
    ).toHaveAttribute('aria-expanded', 'true')
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
