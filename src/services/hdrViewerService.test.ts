import { describe, expect, it, vi } from 'vitest'

const { showDialog } = vi.hoisted(() => ({ showDialog: vi.fn() }))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog })
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import { openHdrViewer } from './hdrViewerService'

describe('openHdrViewer', () => {
  it('opens a full-screen dialog with the full-resolution url and filename title', () => {
    openHdrViewer('/api/view?filename=out.exr&preview=webp;75&rand=1')

    expect(showDialog).toHaveBeenCalledOnce()
    const options = showDialog.mock.calls[0][0]
    expect(options.key).toBe('hdr-viewer')
    expect(options.title).toBe('out.exr')
    expect(options.props.imageUrl).toBe('/api/view?filename=out.exr&rand=1')
    expect(options.dialogComponentProps.size).toBe('full')
  })
})
