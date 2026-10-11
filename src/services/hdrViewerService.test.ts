import { describe, expect, it, vi } from 'vitest'

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
  })

  it('titles and labels a by-id URL with the given filename', () => {
    openHdrViewer('/api/assets/abc/content', 'sky.hdr')

    const options = vi.mocked(useDialogStore().showDialog).mock.calls.at(-1)![0]
    expect(options.title).toBe('sky.hdr')
    expect(options.props).toMatchObject({
      imageUrl: '/api/assets/abc/content',
      filename: 'sky.hdr'
    })
  })
})
