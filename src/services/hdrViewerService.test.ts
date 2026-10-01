import { describe, expect, it, vi } from 'vitest'

import { LOAD3D_VIEWER_CONTENT_CLASS } from '@/components/load3d/load3dViewerDialog'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock(import('@/i18n'))

import { openHdrViewer } from './hdrViewerService'

describe('openHdrViewer', () => {
  it('opens a full-screen dialog with the full-resolution url and filename title', () => {
    openHdrViewer('/api/view?filename=out.exr&preview=webp;75&rand=1')

    expect(useDialogStore().showDialog).toHaveBeenCalledOnce()
    const options = vi.mocked(useDialogStore().showDialog).mock.calls[0][0]
    expect(options.key).toBe('hdr-viewer')
    expect(options.title).toBe('out.exr')
    expect(options.props).toMatchObject({
      imageUrl: '/api/view?filename=out.exr&rand=1'
    })
    expect(options.dialogComponentProps?.size).toBe('full')
    expect(options.dialogComponentProps?.contentClass).toBe(
      LOAD3D_VIEWER_CONTENT_CLASS
    )
  })
})
