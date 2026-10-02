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
const lightsList = () =>
  within(section('Lights')).getByRole('list', { name: 'Lights' })
const lightNames = () =>
  within(lightsList())
    .getAllByRole('listitem')
    .map((item) => item.textContent.trim())
const lightRow = (name: string) =>
  within(lightsList()).getByRole('button', {
    name: new RegExp(`^${name}\\s*(Point|Directional)\\s*\\d+$`)
  })
const expandedRows = () =>
  within(lightsList())
    .queryAllByRole('button', { expanded: true })
    .map((row) => row.textContent.trim())
const editor = () => screen.getByTestId('relight-light-editor')
const toolNames = (toolbar: HTMLElement) =>
  within(toolbar)
    .getAllByRole('button')
    .map((tool) => tool.getAttribute('aria-label') ?? tool.textContent.trim())

async function lightAction(
  user: ReturnType<typeof userEvent.setup>,
  light: string,
  action: string
) {
  if (lightRow(light).getAttribute('aria-expanded') !== 'true')
    await user.click(lightRow(light))
  await user.click(
    within(editor()).getByRole('button', { name: `More for ${light}` })
  )
  await user.click(
    within(editor()).getByRole('menuitem', { name: `${action} ${light}` })
  )
}

describe('RelightStudio', () => {
  it('relights from the floating panel: pick a light, change it, then get the result', async () => {
    const user = await openExample()
    expect(undo()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Download' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    const lights = section('Lights')

    await user.click(lightRow('Cool fill'))
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
    expect(
      within(
        screen.getByRole('toolbar', { name: 'Relight tools' })
      ).queryByRole('link')
    ).toBeNull()
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('selects a light from its handle and expands its row', async () => {
    const user = await openExample()
    const dot = screen.getByRole('button', { name: /^Cool fill\./ })
    expect(dot).toHaveAttribute('aria-pressed', 'false')

    await user.click(dot)

    expect(dot).toHaveAttribute('aria-pressed', 'true')
    expect(lightRow('Cool fill')).toHaveAttribute('aria-expanded', 'true')
    expect(lightRow('Cool fill')).toHaveAttribute('aria-controls', editor().id)
    expect(lightRow('Warm key')).toHaveAttribute('aria-expanded', 'false')
    dot.focus()
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}')
    expect(parseFloat(dot.style.left)).toBeCloseTo(85)
  })

  it.for([
    { clicks: ['Cool fill'], expanded: ['Cool fill'], selected: 'Cool fill' },
    { clicks: ['Warm key'], expanded: [], selected: 'Warm key' },
    {
      clicks: ['Warm key', 'Cool fill'],
      expanded: ['Cool fill'],
      selected: 'Cool fill'
    },
    {
      clicks: ['Warm key', 'Warm key'],
      expanded: ['Warm key'],
      selected: 'Warm key'
    }
  ])(
    'clicking $clicks leaves $expanded open with $selected selected',
    async ({ clicks, expanded, selected }) => {
      const user = await openExample()
      expect(expandedRows()).toEqual([expect.stringContaining('Warm key')])

      for (const name of clicks) await user.click(lightRow(name))

      expect(expandedRows()).toEqual(
        expanded.map((name) => expect.stringContaining(name))
      )
      expect(
        screen.getByRole('button', { name: new RegExp(`^${selected}\\.`) })
      ).toHaveAttribute('aria-pressed', 'true')
    }
  )

  it.for([
    { from: 'Warm key', key: '{ArrowDown}', to: 'Cool fill' },
    { from: 'Cool fill', key: '{ArrowDown}', to: 'Warm key' },
    { from: 'Warm key', key: '{ArrowUp}', to: 'Cool fill' }
  ])('moves focus from $from to $to with $key', async ({ from, key, to }) => {
    const user = await openExample()
    lightRow(from).focus()

    await user.keyboard(key)

    expect(lightRow(to)).toHaveFocus()
    expect(expandedRows()).toEqual([expect.stringContaining('Warm key')])
  })

  it('hides and shows a light from its eye without opening it', async () => {
    const user = await openExample()

    await user.click(
      within(lightsList()).getByRole('button', { name: 'Hide Cool fill' })
    )

    expect(
      within(lightsList()).getByRole('button', { name: 'Show Cool fill' })
    ).toBeVisible()
    expect(lightRow('Cool fill')).toHaveAttribute('aria-expanded', 'false')
    await user.click(within(panel()).getByTestId('relight-run'))
    expect(screen.getByRole('status')).toHaveTextContent('1 light')
    await user.click(
      within(screen.getByRole('status')).getByRole('button', { name: 'Cancel' })
    )
    await user.click(undo())
    expect(
      within(lightsList()).getByRole('button', { name: 'Hide Cool fill' })
    ).toBeVisible()
  })

  it.for([
    {
      kind: 'Point',
      shown: ['Intensity', 'Softness'],
      hidden: ['Direction', 'Elevation']
    },
    {
      kind: 'Directional',
      shown: ['Direction', 'Elevation', 'Intensity'],
      hidden: ['Softness']
    }
  ])(
    'shows the $kind controls once the kind is switched',
    async ({ kind, shown, hidden }) => {
      const user = await openExample()
      await user.click(lightRow('Cool fill'))

      await user.click(within(editor()).getByRole('radio', { name: kind }))

      expect(within(editor()).getByRole('radio', { name: kind })).toBeChecked()
      for (const name of shown)
        expect(within(editor()).getByRole('slider', { name })).toBeVisible()
      for (const name of hidden)
        expect(within(editor()).queryByRole('slider', { name })).toBeNull()
      expect(lightRow('Cool fill')).toHaveAccessibleName(
        new RegExp(`^Cool fill\\s*${kind}`)
      )
    }
  )

  it('turns and raises a directional light from the dial by keyboard, as one undo step', async () => {
    const user = await openExample()
    const dial = within(editor()).getByRole('slider', { name: 'Direction' })
    const readout = screen.getByTestId('relight-dial-readout')
    const elevation = within(editor()).getByRole('slider', {
      name: 'Elevation'
    })
    const before = readout.textContent
    expect(elevation).toHaveValue('15')

    dial.focus()
    await user.keyboard('{ArrowUp}{ArrowUp}{Shift>}{ArrowLeft}{/Shift}')

    expect(elevation).toHaveValue('25')
    expect(dial).toHaveAttribute(
      'aria-valuetext',
      `${Number(dial.getAttribute('aria-valuenow'))}°, elevation 25°`
    )
    expect(readout.textContent).not.toBe(before)
    await user.click(undo())
    expect(readout.textContent).toBe(before)
  })

  it('places a directional light from the direction presets', async () => {
    const user = await openExample()

    await user.click(
      within(editor()).getByRole('button', { name: 'Direction presets' })
    )
    await user.click(within(editor()).getByRole('menuitem', { name: 'Top' }))

    expect(screen.getByTestId('relight-dial-readout')).toHaveTextContent(
      '90° · 20°'
    )
    expect(
      within(editor()).getByRole('slider', { name: 'Elevation' })
    ).toHaveValue('20')
  })

  it('adds lights from the Lights header until the limit, opening each new one', async () => {
    const user = await openExample()
    const add = () =>
      within(section('Lights')).getByRole('button', { name: 'Add light' })

    await user.click(add())
    await user.click(
      within(section('Lights')).getByRole('menuitem', { name: 'Directional' })
    )
    expect(expandedRows()).toEqual([expect.stringContaining('Light 3')])
    expect(
      within(editor()).getByRole('slider', { name: 'Direction' })
    ).toBeVisible()
    expect(add()).toBeEnabled()

    await user.click(add())
    await user.click(
      within(section('Lights')).getByRole('menuitem', { name: 'Point' })
    )

    expect(lightNames()).toHaveLength(4)
    expect(section('Lights')).toHaveAccessibleName('Lights')
    expect(within(panel()).getByText('4 of 4')).toBeVisible()
    expect(add()).toBeDisabled()
    const tools = screen.getByRole('toolbar', { name: 'Relight tools' })
    expect(
      within(tools).getByRole('button', { name: 'Add light' })
    ).toBeDisabled()
  })

  it('duplicates and deletes lights from the open row menu, and undoes', async () => {
    const user = await openExample()

    await lightAction(user, 'Warm key', 'Duplicate')
    expect(expandedRows()).toEqual([expect.stringContaining('Warm key copy')])
    await lightAction(user, 'Cool fill', 'Delete')
    expect(lightNames()).toEqual([
      expect.stringContaining('Warm key'),
      expect.stringContaining('Warm key copy')
    ])

    await user.click(undo())
    expect(lightNames()).toHaveLength(3)
    await user.click(undo())
    expect(lightNames()).toHaveLength(2)
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
      expect(
        within(lights).getByRole('switch', { name: 'Cast shadows' })
      ).toHaveAttribute('aria-checked', castShadows)
      expect(
        within(lights).getByRole('slider', { name: 'Elevation' })
      ).toHaveValue(elevation)
    }
  )

  it.for([
    { layout: 'd', wide: true, last: 'Light handles' },
    { layout: 'd', wide: false, last: 'Light handles' },
    { layout: 'e', wide: true, last: 'Relight 20 credits' }
  ])(
    'keeps undo and redo at the right end of the tools in layout $layout (wide: $wide)',
    async ({ layout, wide, last }) => {
      screenIsWide(wide)
      await openExample(layout)

      const tools = toolNames(
        screen.getByRole('toolbar', { name: 'Relight tools' })
      )
      expect(tools.slice(-3)).toEqual([last, 'Undo', 'Redo'])
    }
  )

  it('keeps the seed as a row of the panel, outside Generation', async () => {
    await openExample()
    expect(
      within(panel()).getByRole('button', { name: /^Generation/ })
    ).toHaveAttribute('aria-expanded', 'false')
    expect(
      within(panel()).getByRole('spinbutton', { name: 'Seed' })
    ).toBeVisible()
  })

  it("keeps the seed in the bottom composer's Generation tray", async () => {
    const user = await openExample('e')
    await user.click(screen.getByRole('button', { name: /^Generation/ }))
    expect(
      within(screen.getByRole('dialog', { name: 'Generation' })).getByRole(
        'spinbutton',
        { name: 'Seed' }
      )
    ).toBeVisible()
  })

  it('zooms the photo from the zoom control and the + - 0 keys, but not while typing', async () => {
    const user = await openExample()
    const fit = () => screen.getByTestId('editor-zoom-fit')
    expect(fit()).toHaveTextContent('100%')

    await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(fit()).toHaveTextContent('125%')
    expect(fit()).toHaveAccessibleName('Fit to screen, now 125%')
    await user.keyboard('-')
    await user.keyboard('-')
    expect(fit()).toHaveTextContent('80%')
    await user.keyboard('0')
    expect(fit()).toHaveTextContent('100%')

    await user.click(within(panel()).getByRole('spinbutton', { name: 'Seed' }))
    await user.keyboard('+')
    expect(fit()).toHaveTextContent('100%')
    await user.click(fit())
    expect(screen.getByTestId('editor-frame')).toHaveStyle({
      transform: 'translate(0px, 0px) scale(1)'
    })
  })

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
