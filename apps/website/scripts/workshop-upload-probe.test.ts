import { describe, expect, it, vi } from 'vitest'

import { WorkshopRouterError } from '../src/config/workshop-router-errors'
import { createWorkshopUrlUploader } from '../src/config/workshop-url-upload'
import { runWorkshopUploadProbe } from './workshop-upload-probe'

vi.mock(import('../src/config/workshop-url-upload'))

describe('browser upload diagnostic', () => {
  it.for(['upload_grant', 'upload_put'] as const)(
    'reports %s failures without private error details',
    async (stage) => {
      vi.mocked(createWorkshopUrlUploader).mockReturnValue(
        vi
          .fn()
          .mockRejectedValue(
            new WorkshopRouterError(
              'upload',
              'private-request',
              {},
              undefined,
              stage
            )
          )
      )
      const file = new File(['png'], 'private-file.png', { type: 'image/png' })

      expect(await runWorkshopUploadProbe(file, 'private-token')).toEqual({
        passed: false,
        stage,
        bytes: 3
      })
    }
  )

  it.for([
    { width: 1, height: 1, passed: true },
    { width: 2, height: 1, passed: false },
    { width: 1, height: 2, passed: false }
  ])(
    'checks decoded dimensions $width by $height',
    async ({ width, height, passed }) => {
      vi.mocked(createWorkshopUrlUploader).mockReturnValue(
        vi.fn().mockResolvedValue('data:image/png;base64,iVBORw0KGgo=')
      )
      vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue()
      vi.spyOn(
        HTMLImageElement.prototype,
        'naturalWidth',
        'get'
      ).mockReturnValue(width)
      vi.spyOn(
        HTMLImageElement.prototype,
        'naturalHeight',
        'get'
      ).mockReturnValue(height)
      const file = new File(['png'], 'probe.png', { type: 'image/png' })

      expect(await runWorkshopUploadProbe(file, 'private-token')).toEqual({
        passed,
        stage: 'decode',
        bytes: 3
      })
    }
  )

  it('reports unreadable images as decode failures without their URL', async () => {
    vi.mocked(createWorkshopUrlUploader).mockReturnValue(
      vi.fn().mockResolvedValue('data:image/png;base64,aW52YWxpZA==')
    )
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockRejectedValue(
      new Error('private image URL')
    )
    const file = new File(['png'], 'probe.png', { type: 'image/png' })

    expect(await runWorkshopUploadProbe(file, 'private-token')).toEqual({
      passed: false,
      stage: 'decode',
      bytes: 3
    })
  })
})
