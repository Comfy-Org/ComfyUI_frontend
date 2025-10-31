import { describe, expect, it } from 'vitest'

import { getMediaTypeFromFilename, truncateFilename } from '@/utils/formatUtil'

describe('formatUtil', () => {
  describe('truncateFilename', () => {
    it('should not truncate short filenames', () => {
      expect(truncateFilename('test.png')).toBe('test.png')
      expect(truncateFilename('short.jpg', 10)).toBe('short.jpg')
    })

    it('should truncate long filenames while preserving extension', () => {
      const longName = 'this-is-a-very-long-filename-that-needs-truncation.png'
      const truncated = truncateFilename(longName, 20)
      expect(truncated).toContain('...')
      expect(truncated.endsWith('.png')).toBe(true)
      expect(truncated.length).toBeLessThanOrEqual(25) // 20 + '...' + extension
    })

    it('should handle filenames without extensions', () => {
      const longName = 'this-is-a-very-long-filename-without-extension'
      const truncated = truncateFilename(longName, 20)
      expect(truncated).toContain('...')
      expect(truncated.length).toBeLessThanOrEqual(23) // 20 + '...'
    })

    it('should handle empty strings', () => {
      expect(truncateFilename('')).toBe('')
      expect(truncateFilename('', 10)).toBe('')
    })

    it('should preserve the start and end of the filename', () => {
      const longName = 'ComfyUI_00001_timestamp_2024_01_01.png'
      const truncated = truncateFilename(longName, 20)
      expect(truncated).toMatch(/^ComfyUI.*01\.png$/)
      expect(truncated).toContain('...')
    })

    it('should handle files with multiple dots', () => {
      const filename = 'my.file.with.multiple.dots.txt'
      const truncated = truncateFilename(filename, 15)
      expect(truncated.endsWith('.txt')).toBe(true)
      expect(truncated).toContain('...')
    })
  })

  describe('getMediaTypeFromFilename', () => {
    describe('image files', () => {
      const imageTestCases = [
        { filename: 'test.png', expected: 'image' },
        { filename: 'photo.jpg', expected: 'image' },
        { filename: 'image.jpeg', expected: 'image' },
        { filename: 'animation.gif', expected: 'image' },
        { filename: 'web.webp', expected: 'image' },
        { filename: 'bitmap.bmp', expected: 'image' }
      ]

      it.for(imageTestCases)(
        'should identify $filename as $expected',
        ({ filename, expected }) => {
          expect(getMediaTypeFromFilename(filename)).toBe(expected)
        }
      )

      it('should handle uppercase extensions', () => {
        expect(getMediaTypeFromFilename('test.PNG')).toBe('image')
        expect(getMediaTypeFromFilename('photo.JPG')).toBe('image')
      })
    })

    describe('video files', () => {
      it('should identify video extensions correctly', () => {
        expect(getMediaTypeFromFilename('video.mp4')).toBe('video')
        expect(getMediaTypeFromFilename('clip.webm')).toBe('video')
        expect(getMediaTypeFromFilename('movie.mov')).toBe('video')
        expect(getMediaTypeFromFilename('film.avi')).toBe('video')
      })
    })

    describe('audio files', () => {
      it('should identify audio extensions correctly', () => {
        expect(getMediaTypeFromFilename('song.mp3')).toBe('audio')
        expect(getMediaTypeFromFilename('sound.wav')).toBe('audio')
        expect(getMediaTypeFromFilename('music.ogg')).toBe('audio')
        expect(getMediaTypeFromFilename('audio.flac')).toBe('audio')
      })
    })

    describe('3D files', () => {
      it('should identify 3D file extensions correctly', () => {
        expect(getMediaTypeFromFilename('model.obj')).toBe('3D')
        expect(getMediaTypeFromFilename('scene.fbx')).toBe('3D')
        expect(getMediaTypeFromFilename('asset.gltf')).toBe('3D')
        expect(getMediaTypeFromFilename('binary.glb')).toBe('3D')
      })
    })

    describe('edge cases', () => {
      it('should handle empty strings', () => {
        expect(getMediaTypeFromFilename('')).toBe('image')
      })

      it('should handle files without extensions', () => {
        expect(getMediaTypeFromFilename('README')).toBe('image')
      })

      it('should handle unknown extensions', () => {
        expect(getMediaTypeFromFilename('document.pdf')).toBe('image')
        expect(getMediaTypeFromFilename('data.json')).toBe('image')
      })

      it('should handle files with multiple dots', () => {
        expect(getMediaTypeFromFilename('my.file.name.png')).toBe('image')
        expect(getMediaTypeFromFilename('archive.tar.gz')).toBe('image')
      })

      it('should handle paths with directories', () => {
        expect(getMediaTypeFromFilename('/path/to/image.png')).toBe('image')
        expect(getMediaTypeFromFilename('C:\\Windows\\video.mp4')).toBe('video')
      })

      it('should handle null and undefined gracefully', () => {
        expect(getMediaTypeFromFilename(null as any)).toBe('image')
        expect(getMediaTypeFromFilename(undefined as any)).toBe('image')
      })

      it('should handle special characters in filenames', () => {
        expect(getMediaTypeFromFilename('test@#$.png')).toBe('image')
        expect(getMediaTypeFromFilename('video (1).mp4')).toBe('video')
        expect(getMediaTypeFromFilename('[2024] audio.mp3')).toBe('audio')
      })

      it('should handle very long filenames', () => {
        const longFilename = 'a'.repeat(1000) + '.png'
        expect(getMediaTypeFromFilename(longFilename)).toBe('image')
      })

      it('should handle mixed case extensions', () => {
        expect(getMediaTypeFromFilename('test.PnG')).toBe('image')
        expect(getMediaTypeFromFilename('video.Mp4')).toBe('video')
        expect(getMediaTypeFromFilename('audio.WaV')).toBe('audio')
      })
    })
  })
})
