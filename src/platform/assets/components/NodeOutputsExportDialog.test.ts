import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'

import NodeOutputsExportDialog from './NodeOutputsExportDialog.vue'

const items = [
  { name: 'shot_001.exr', thumbnailUrl: '/api/view?filename=shot_001.exr' },
  { name: 'shot_002.exr', thumbnailUrl: '/api/view?filename=shot_002.exr' },
  { name: 'shot_003.exr', thumbnailUrl: '/api/view?filename=shot_003.exr' }
]

function renderDialog() {
  const onExport = vi.fn<(selectedIndices: number[]) => void>()
  const onCancel = vi.fn<() => void>()
  render(NodeOutputsExportDialog, {
    props: { items, onExport, onCancel },
    global: { plugins: [i18n] }
  })
  return { onExport, onCancel, user: userEvent.setup() }
}

const checkbox = (name: string) => screen.getByRole('checkbox', { name })
const exportButton = () => screen.getByRole('button', { name: /^Export/ })

describe('NodeOutputsExportDialog', () => {
  it('starts with every output selected', async () => {
    const { onExport, user } = renderDialog()

    expect(screen.queryAllByRole('checkbox', { checked: false })).toEqual([])
    expect(exportButton()).toHaveTextContent('Export (3)')

    await user.click(exportButton())

    expect(onExport).toHaveBeenCalledWith([0, 1, 2])
  })

  it('exports only the outputs left selected', async () => {
    const { onExport, user } = renderDialog()

    await user.click(checkbox('shot_002.exr'))

    expect(checkbox('Download all')).not.toBeChecked()
    expect(exportButton()).toHaveTextContent('Export (2)')

    await user.click(exportButton())

    expect(onExport).toHaveBeenCalledWith([0, 2])
  })

  it('toggles every output from the select all checkbox', async () => {
    const { onExport, user } = renderDialog()

    await user.click(checkbox('Download all'))

    expect(screen.queryAllByRole('checkbox', { checked: true })).toEqual([])
    expect(exportButton()).toBeDisabled()

    await user.click(checkbox('Download all'))
    await user.click(exportButton())

    expect(onExport).toHaveBeenCalledWith([0, 1, 2])
  })

  it('cancels without exporting', async () => {
    const { onExport, onCancel, user } = renderDialog()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledOnce()
    expect(onExport).not.toHaveBeenCalled()
  })
})
