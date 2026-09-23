import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ViewerExportControls from '@/components/load3d/controls/viewer/ViewerExportControls.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { load3d: { export: 'Export' } } }
})

function renderComponent(
  onExportModel?: (format: string) => void,
  sourceFormat: string | null = null
) {
  const utils = render(ViewerExportControls, {
    props: { onExportModel, sourceFormat },
    global: { plugins: [i18n] }
  })
  return { ...utils, user: userEvent.setup() }
}

describe('ViewerExportControls', () => {
  it('renders all four export format options', async () => {
    const { user } = renderComponent()
    await user.click(screen.getByRole('combobox'))
    const options = await screen.findAllByRole('option')

    expect(options.map((option) => option.textContent)).toEqual([
      'GLB',
      'OBJ',
      'STL',
      'FBX'
    ])
  })

  it('defaults the export format to obj', async () => {
    renderComponent()
    await waitFor(() =>
      expect(screen.getByRole('combobox')).toHaveTextContent('OBJ')
    )
  })

  it('emits exportModel with the currently selected format when the button is clicked', async () => {
    const onExportModel = vi.fn()
    const { user } = renderComponent(onExportModel)

    await user.click(screen.getByRole('button', { name: 'Export' }))

    expect(onExportModel).toHaveBeenCalledWith('obj')
  })

  it('emits the newly chosen format after the user changes the dropdown', async () => {
    const onExportModel = vi.fn()
    const { user } = renderComponent(onExportModel)

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'GLB' }))
    await user.click(screen.getByRole('button', { name: 'Export' }))

    expect(onExportModel).toHaveBeenCalledWith('glb')
  })

  it('offers only the source format for direct-export files (e.g. spz)', async () => {
    const onExportModel = vi.fn()
    const { user } = renderComponent(onExportModel, 'spz')
    await user.click(screen.getByRole('combobox'))

    expect(
      (await screen.findAllByRole('option')).map((option) => option.textContent)
    ).toEqual(['SPZ'])
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'Export' }))

    expect(onExportModel).toHaveBeenCalledWith('spz')
  })

  it('repairs the selected format when sourceFormat switches to a direct-export type', async () => {
    const onExportModel = vi.fn()
    const { user, rerender } = renderComponent(onExportModel, null)
    const select = screen.getByRole('combobox')

    await waitFor(() => expect(select).toHaveTextContent('OBJ'))

    await rerender({ onExportModel, sourceFormat: 'ply' })

    await user.click(select)
    expect(
      (await screen.findAllByRole('option')).map((option) => option.textContent)
    ).toEqual(['PLY'])
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'Export' }))

    expect(onExportModel).toHaveBeenCalledWith('ply')
  })
})
