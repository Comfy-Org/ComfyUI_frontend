import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ViewerExportControls from '@/components/load3d/controls/viewer/ViewerExportControls.vue'

vi.mock('@/components/ui/select/Select.vue')
vi.mock('@/components/ui/select/SelectContent.vue')
vi.mock('@/components/ui/select/SelectItem.vue')
vi.mock('@/components/ui/select/SelectTrigger.vue')
vi.mock('@/components/ui/select/SelectValue.vue')

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
  it('renders all four export format options', () => {
    renderComponent()
    const select = screen.getByRole('combobox') as HTMLSelectElement
    const optionValues = Array.from(select.options).map((o) => o.value)

    expect(optionValues).toEqual(['glb', 'obj', 'stl', 'fbx'])
  })

  it('defaults the export format to obj', () => {
    renderComponent()
    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe('obj')
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

    await user.selectOptions(screen.getByRole('combobox'), 'glb')
    await user.click(screen.getByRole('button', { name: 'Export' }))

    expect(onExportModel).toHaveBeenCalledWith('glb')
  })

  it('offers only the source format for direct-export files (e.g. spz)', async () => {
    const onExportModel = vi.fn()
    const { user } = renderComponent(onExportModel, 'spz')
    const select = screen.getByRole('combobox') as HTMLSelectElement

    expect(Array.from(select.options).map((o) => o.value)).toEqual(['spz'])

    await user.click(screen.getByRole('button', { name: 'Export' }))

    expect(onExportModel).toHaveBeenCalledWith('spz')
  })

  it('repairs the selected format when sourceFormat switches to a direct-export type', async () => {
    const onExportModel = vi.fn()
    const { user, rerender } = renderComponent(onExportModel, null)
    const select = screen.getByRole('combobox') as HTMLSelectElement

    expect(select.value).toBe('obj')

    await rerender({ onExportModel, sourceFormat: 'ply' })

    expect(Array.from(select.options).map((o) => o.value)).toEqual(['ply'])

    await user.click(screen.getByRole('button', { name: 'Export' }))

    expect(onExportModel).toHaveBeenCalledWith('ply')
  })
})
