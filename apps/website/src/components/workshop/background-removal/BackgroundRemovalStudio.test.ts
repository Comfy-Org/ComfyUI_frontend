import { fireEvent, render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderCutout } from '../../../lib/workshop/background-removal/render-cutout'
import BackgroundRemovalStudio from './BackgroundRemovalStudio.vue'

vi.mock(
  import('../../../lib/workshop/background-removal/render-cutout'),
  () => ({
    renderCutout: vi.fn(() => Promise.resolve('blob:cutout'))
  })
)

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
  vi.mocked(renderCutout).mockClear()
  screenIsWide(true)
})

async function openExample(layout?: string) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(BackgroundRemovalStudio, { props: { layout } })
  await user.click(screen.getByRole('button', { name: 'Try the example' }))
  return user
}

const panel = () =>
  screen.getByRole('complementary', { name: 'Background Removal settings' })
const section = (name: string) => within(panel()).getByRole('region', { name })
const tile = (name: string) =>
  within(section('Background')).getByRole('radio', { name })
const undo = () => screen.getByRole('button', { name: 'Undo' })

describe('BackgroundRemovalStudio', () => {
  it('removes the background from the panel and opens the result on Compare', async () => {
    const user = await openExample()
    expect(tile('Transparent')).toBeChecked()
    expect(undo()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Download' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )

    await user.click(tile('Lilac'))
    await user.click(
      within(panel()).getByRole('button', { name: 'Format: PNG' })
    )
    await user.click(
      screen.getByRole('menuitemradio', { name: 'WebP Smaller file' })
    )
    expect(
      within(panel()).getByRole('button', { name: /^Background\s*Lilac/ })
    ).toBeVisible()

    await user.click(within(panel()).getByTestId('background-removal-run'))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Removing the background…'
    )
    expect(screen.getByRole('status')).toHaveTextContent('0:00 · Lilac WebP')
    await vi.advanceTimersByTimeAsync(3000)

    const download = await screen.findByRole('link', { name: 'Download' })
    expect(download).toHaveAttribute('href', 'blob:cutout')
    expect(download).toHaveAttribute('download', 'potted-plant-cutout.webp')
    expect(
      within(
        screen.getByRole('toolbar', { name: 'Background Removal tools' })
      ).queryByRole('link')
    ).toBeNull()
    expect(vi.mocked(renderCutout)).toHaveBeenCalledWith({
      imageUrl: '/images/apps/background-removal/plant.jpg',
      mode: 'remove',
      background: { kind: 'color', color: '#d9ccf5' },
      format: 'webp',
      edgeSoftness: 20
    })
    expect(screen.getByRole('button', { name: 'Compare' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(
      screen.getByRole('slider', {
        name: 'Drag to compare the original and the result'
      })
    ).toBeVisible()
  })

  it('undoes and redoes a background pick', async () => {
    const user = await openExample()
    await user.click(tile('White'))

    await user.click(undo())
    expect(tile('Transparent')).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Redo' }))
    expect(tile('White')).toBeChecked()
  })

  it('keeps only the edge softness in the collapsed Advanced section, and no seed outside Replace', async () => {
    const user = await openExample()
    expect(
      within(panel()).queryByRole('slider', { name: 'Edge softness' })
    ).toBeNull()
    expect(
      within(panel()).queryByRole('spinbutton', { name: 'Seed' })
    ).toBeNull()

    await user.click(within(panel()).getByRole('button', { name: /^Advanced/ }))
    const edge = within(section('Advanced')).getByRole('slider', {
      name: 'Edge softness'
    })
    await fireEvent.update(edge, '35')
    await fireEvent.update(edge, '60')

    expect(
      within(panel()).getByRole('button', { name: /^Advanced\s*Edge 60%/ })
    ).toBeVisible()
    await user.click(undo())
    expect(edge).toHaveValue('20')
    expect(within(section('Advanced')).getAllByRole('slider')).toHaveLength(1)
  })

  it('picks a custom colour from the last swatch', async () => {
    const user = await openExample()
    await user.click(tile('Custom colour'))

    const picker = screen.getByRole('dialog', { name: 'Custom colour' })
    const hex = within(picker).getByRole('textbox')
    await user.clear(hex)
    await user.type(hex, '#336699{Enter}')

    expect(tile('Custom colour')).toBeChecked()
    expect(tile('Transparent')).not.toBeChecked()
    expect(
      within(panel()).getByRole('button', { name: /^Background\s*#336699/ })
    ).toBeVisible()
    await user.click(within(panel()).getByTestId('background-removal-run'))
    expect(vi.mocked(renderCutout)).toHaveBeenCalledWith(
      expect.objectContaining({
        background: { kind: 'color', color: '#336699' }
      })
    )
  })

  it('replaces the background from a description, with the seed as a row of its own', async () => {
    const user = await openExample()
    await user.click(
      within(section('Background')).getByRole('radio', { name: 'Replace' })
    )
    const run = within(panel()).getByTestId('background-removal-run')
    expect(run).toHaveTextContent('Add a prompt or reference')
    expect(run).toHaveAttribute(
      'title',
      'Describe a background or add a reference image.'
    )
    expect(run).toBeDisabled()
    expect(
      within(section('Background')).queryByText(/Add a prompt or reference/)
    ).toBeNull()
    const seed = within(panel()).getByRole('spinbutton', { name: 'Seed' })
    expect(section('Background')).not.toContainElement(seed)

    await user.click(
      within(section('Background')).getByRole('button', { name: 'Model: Auto' })
    )
    await user.click(
      screen.getByRole('menuitemradio', { name: 'Seedream 4.5' })
    )
    await user.type(
      within(section('Background')).getByRole('textbox', {
        name: 'New background'
      }),
      'a terracotta wall'
    )
    expect(run).toBeEnabled()
    expect(run).toHaveTextContent('Replace background')
    await user.click(run)

    expect(vi.mocked(renderCutout)).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'replace',
        replace: {
          prompt: 'a terracotta wall',
          model: 'byteplus--seedream-4-5--edit-images',
          count: 1,
          seed: 42
        }
      })
    )
    await vi.advanceTimersByTimeAsync(3000)
    expect(
      await screen.findByRole('link', { name: 'Download' })
    ).toHaveAttribute('download', 'potted-plant-new-background.png')
  })

  it('adjusts the chosen layer live on the photo and sends the values', async () => {
    const user = await openExample()
    await user.click(
      within(section('Background')).getByRole('radio', { name: 'Adjust' })
    )
    await user.click(
      within(section('Background')).getByRole('radio', { name: 'Foreground' })
    )
    await fireEvent.update(
      within(section('Background')).getByRole('slider', { name: 'Grayscale' }),
      '40'
    )

    expect(screen.getByTestId('background-removal-foreground')).toHaveStyle({
      filter: 'grayscale(40%)'
    })
    expect(
      within(panel()).getByRole('button', {
        name: /^Background\s*Adjust · Foreground/
      })
    ).toBeVisible()
    await user.click(within(panel()).getByTestId('background-removal-run'))
    expect(vi.mocked(renderCutout)).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'adjust',
        adjust: expect.objectContaining({ target: 'foreground', grayscale: 40 })
      })
    )
  })

  it('shows the hint on the photo until a setting is touched', async () => {
    const user = await openExample()
    const hint = 'Pick a background, then run'
    expect(screen.getByTestId('background-removal-stage')).toHaveTextContent(
      hint
    )

    await user.click(tile('White'))

    expect(screen.queryByText(hint)).toBeNull()
  })

  it('cancels a run from the photo and goes back to editing', async () => {
    const user = await openExample()
    await user.click(within(panel()).getByTestId('background-removal-run'))

    await user.click(
      within(screen.getByRole('status')).getByRole('button', { name: 'Cancel' })
    )

    expect(screen.queryByRole('status')).toBeNull()
    expect(tile('Transparent')).toBeEnabled()
  })

  it('goes back to the settings from the result', async () => {
    const user = await openExample()
    await user.click(within(panel()).getByTestId('background-removal-run'))
    await vi.advanceTimersByTimeAsync(3000)

    await user.click(
      await screen.findByRole('button', { name: 'Edit settings' })
    )

    expect(screen.queryByRole('link', { name: 'Download' })).toBeNull()
    expect(tile('Transparent')).toBeEnabled()
  })

  it('opens on phones as a sheet with a summary and the run button', async () => {
    screenIsWide(false)
    const user = await openExample()
    expect(
      within(panel()).getByRole('button', { name: 'Transparent · PNG' })
    ).toHaveAttribute('aria-expanded', 'false')
    expect(within(panel()).getByTestId('background-removal-run')).toBeEnabled()

    await user.click(
      within(panel()).getByRole('button', { name: 'Show all settings' })
    )

    expect(section('Background')).toBeVisible()
  })

  it.for([
    { layout: 'd', wide: true, tools: ['Undo', 'Redo'] },
    { layout: 'd', wide: false, tools: ['Undo', 'Redo'] },
    {
      layout: 'e',
      wide: true,
      tools: ['Remove background 4 credits', 'Undo', 'Redo']
    }
  ])(
    'keeps undo and redo at the right end of the tools in layout $layout (wide: $wide)',
    async ({ layout, wide, tools }) => {
      screenIsWide(wide)
      await openExample(layout)

      const names = within(
        screen.getByRole('toolbar', { name: 'Background Removal tools' })
      )
        .getAllByRole('button')
        .map(
          (tool) => tool.getAttribute('aria-label') ?? tool.textContent.trim()
        )
      expect(names.slice(-tools.length)).toEqual(tools)
    }
  )

  it('keeps the bottom dock and its trays in the bottom composer layout', async () => {
    const user = await openExample('e')
    expect(screen.queryByRole('complementary')).toBeNull()

    await user.click(screen.getByRole('button', { name: /Background/ }))
    const tray = screen.getByRole('dialog', { name: 'Background' })
    await user.click(within(tray).getByRole('radio', { name: 'White' }))

    expect(tray).toHaveTextContent('White')
    expect(undo()).toBeEnabled()
    expect(
      screen.getByRole('toolbar', { name: 'Background Removal tools' })
    ).toContainElement(screen.getByTestId('background-removal-run'))
  })
})
