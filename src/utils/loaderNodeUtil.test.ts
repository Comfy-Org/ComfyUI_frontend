import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getMediaTypeFromFilename } from '@comfyorg/shared-frontend-utils/formatUtil'
import { detectNodeTypeFromFilename } from '@/utils/loaderNodeUtil'

vi.mock('@comfyorg/shared-frontend-utils/formatUtil', () => ({
  getMediaTypeFromFilename: vi.fn()
}))

const mockGetMediaTypeFromFilename = vi.mocked(getMediaTypeFromFilename)

describe('loaderNodeUtil', () => {
  beforeEach(() => {
    mockGetMediaTypeFromFilename.mockReset()
  })

  describe('detectNodeTypeFromFilename', () => {
    it('maps image files to LoadImage', () => {
      mockGetMediaTypeFromFilename.mockReturnValue('image')

      expect(detectNodeTypeFromFilename('image.png')).toEqual({
        nodeType: 'LoadImage',
        widgetName: 'image'
      })
    })

    it('maps video files to LoadVideo', () => {
      mockGetMediaTypeFromFilename.mockReturnValue('video')

      expect(detectNodeTypeFromFilename('video.mp4')).toEqual({
        nodeType: 'LoadVideo',
        widgetName: 'file'
      })
    })

    it('maps audio files to LoadAudio', () => {
      mockGetMediaTypeFromFilename.mockReturnValue('audio')

      expect(detectNodeTypeFromFilename('audio.mp3')).toEqual({
        nodeType: 'LoadAudio',
        widgetName: 'audio'
      })
    })

    it('maps 3D files to Load3D', () => {
      mockGetMediaTypeFromFilename.mockReturnValue('3D')

      expect(detectNodeTypeFromFilename('model.glb')).toEqual({
        nodeType: 'Load3D',
        widgetName: 'model_file'
      })
    })

    it('returns null node mapping for unsupported files', () => {
      mockGetMediaTypeFromFilename.mockReturnValue('unknown' as never)

      expect(detectNodeTypeFromFilename('document.txt')).toEqual({
        nodeType: null,
        widgetName: null
      })
    })
  })
})
