import { describe, expect, it } from 'vitest'

import {
  appendWorkflowJsonExt,
  ensureWorkflowSuffix,
  getFileExtension,
  getFilenameDetails,
  getMediaTypeFromFilename,
  getPathDetails,
  highlightQuery,
  isPreviewableMediaFilename,
  truncateFilename
} from './formatUtil'

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
        { filename: 'bitmap.bmp', expected: 'image' },
        { filename: 'modern.avif', expected: 'image' }
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
        expect(getMediaTypeFromFilename('apple.usdz')).toBe('3D')
        expect(getMediaTypeFromFilename('mesh.ply')).toBe('3D')
        expect(getMediaTypeFromFilename('print.stl')).toBe('3D')
        expect(getMediaTypeFromFilename('point-cloud.spz')).toBe('3D')
        expect(getMediaTypeFromFilename('gaussian.splat')).toBe('3D')
        expect(getMediaTypeFromFilename('scene.ksplat')).toBe('3D')
      })
    })

    describe('text files', () => {
      it('should identify text file extensions correctly', () => {
        expect(getMediaTypeFromFilename('notes.txt')).toBe('text')
        expect(getMediaTypeFromFilename('readme.md')).toBe('text')
        expect(getMediaTypeFromFilename('data.json')).toBe('text')
        expect(getMediaTypeFromFilename('table.csv')).toBe('text')
        expect(getMediaTypeFromFilename('config.yaml')).toBe('text')
      })
    })

    describe('edge cases', () => {
      it('should handle empty strings', () => {
        expect(getMediaTypeFromFilename('')).toBe('other')
      })

      it('should handle files without extensions', () => {
        expect(getMediaTypeFromFilename('README')).toBe('other')
      })

      it('should handle unknown extensions', () => {
        expect(getMediaTypeFromFilename('document.pdf')).toBe('other')
        expect(getMediaTypeFromFilename('archive.bin')).toBe('other')
      })

      it('should handle files with multiple dots', () => {
        expect(getMediaTypeFromFilename('my.file.name.png')).toBe('image')
        expect(getMediaTypeFromFilename('archive.tar.gz')).toBe('other')
      })

      it('should handle paths with directories', () => {
        expect(getMediaTypeFromFilename('/path/to/image.png')).toBe('image')
        expect(getMediaTypeFromFilename('C:\\Windows\\video.mp4')).toBe('video')
      })

      it('should handle null and undefined gracefully', () => {
        expect(getMediaTypeFromFilename(null)).toBe('other')
        expect(getMediaTypeFromFilename(undefined)).toBe('other')
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

  describe('getFileExtension', () => {
    it('returns a normalized lowercase extension when present', () => {
      expect(getFileExtension('mesh.PLY')).toBe('ply')
      expect(getFileExtension('/path/to/file.glb')).toBe('glb')
    })

    it('returns null when no extension is present', () => {
      expect(getFileExtension('README')).toBe(null)
      expect(getFileExtension('')).toBe(null)
      expect(getFileExtension(undefined)).toBe(null)
    })
  })

  describe('highlightQuery', () => {
    it('should return text unchanged when query is empty', () => {
      expect(highlightQuery('Hello World', '')).toBe('Hello World')
    })

    it('should wrap matching text in highlight span', () => {
      const result = highlightQuery('Hello World', 'World')
      expect(result).toBe('Hello <span class="highlight">World</span>')
    })

    it('should be case-insensitive', () => {
      const result = highlightQuery('Hello World', 'hello')
      expect(result).toBe('<span class="highlight">Hello</span> World')
    })

    it('should sanitize text by default', () => {
      const result = highlightQuery('<script>alert("xss")</script>', 'alert')
      expect(result).not.toContain('<script>')
    })

    it('should skip sanitization when sanitize is false', () => {
      const result = highlightQuery('<b>bold</b>', 'bold', false)
      expect(result).toContain('<b>')
    })

    it('should escape special regex characters in query', () => {
      const result = highlightQuery('price is $10.00', '$10')
      expect(result).toContain('<span class="highlight">$10</span>')
    })

    it('should highlight multiple occurrences', () => {
      const result = highlightQuery('foo bar foo', 'foo')
      expect(result).toBe(
        '<span class="highlight">foo</span> bar <span class="highlight">foo</span>'
      )
    })
  })

  describe('getFilenameDetails', () => {
    it('splits simple filenames into name and suffix', () => {
      expect(getFilenameDetails('file.txt')).toEqual({
        filename: 'file',
        suffix: 'txt'
      })
    })

    it('handles filenames with multiple dots', () => {
      expect(getFilenameDetails('my.file.name.png')).toEqual({
        filename: 'my.file.name',
        suffix: 'png'
      })
    })

    it('handles filenames without extension', () => {
      expect(getFilenameDetails('README')).toEqual({
        filename: 'README',
        suffix: null
      })
    })

    it('recognises .app.json as a compound extension', () => {
      expect(getFilenameDetails('workflow.app.json')).toEqual({
        filename: 'workflow',
        suffix: 'app.json'
      })
    })

    it('recognises .app.json case-insensitively', () => {
      expect(getFilenameDetails('Workflow.APP.JSON')).toEqual({
        filename: 'Workflow',
        suffix: 'app.json'
      })
    })

    it('handles regular .json files normally', () => {
      expect(getFilenameDetails('workflow.json')).toEqual({
        filename: 'workflow',
        suffix: 'json'
      })
    })

    it('treats bare .app.json as a dotfile without basename', () => {
      expect(getFilenameDetails('.app.json')).toEqual({
        filename: '.app',
        suffix: 'json'
      })
    })
  })

  describe('getPathDetails', () => {
    it('splits a path with .app.json extension', () => {
      const result = getPathDetails('workflows/test.app.json')
      expect(result).toEqual({
        directory: 'workflows',
        fullFilename: 'test.app.json',
        filename: 'test',
        suffix: 'app.json'
      })
    })

    it('splits a path with .json extension', () => {
      const result = getPathDetails('workflows/test.json')
      expect(result).toEqual({
        directory: 'workflows',
        fullFilename: 'test.json',
        filename: 'test',
        suffix: 'json'
      })
    })
  })

  describe('appendWorkflowJsonExt', () => {
    it('appends .app.json when isApp is true', () => {
      expect(appendWorkflowJsonExt('test', true)).toBe('test.app.json')
    })

    it('appends .json when isApp is false', () => {
      expect(appendWorkflowJsonExt('test', false)).toBe('test.json')
    })

    it('replaces .json with .app.json when isApp is true', () => {
      expect(appendWorkflowJsonExt('test.json', true)).toBe('test.app.json')
    })

    it('replaces .app.json with .json when isApp is false', () => {
      expect(appendWorkflowJsonExt('test.app.json', false)).toBe('test.json')
    })

    it('leaves .app.json unchanged when isApp is true', () => {
      expect(appendWorkflowJsonExt('test.app.json', true)).toBe('test.app.json')
    })

    it('leaves .json unchanged when isApp is false', () => {
      expect(appendWorkflowJsonExt('test.json', false)).toBe('test.json')
    })

    it('handles case-insensitive extensions', () => {
      expect(appendWorkflowJsonExt('test.JSON', true)).toBe('test.app.json')
      expect(appendWorkflowJsonExt('test.APP.JSON', false)).toBe('test.json')
    })
  })

  describe('ensureWorkflowSuffix', () => {
    it('appends suffix when missing', () => {
      expect(ensureWorkflowSuffix('file', 'json')).toBe('file.json')
    })

    it('does not double-append when suffix already present', () => {
      expect(ensureWorkflowSuffix('file.json', 'json')).toBe('file.json')
    })

    it('appends compound suffix when missing', () => {
      expect(ensureWorkflowSuffix('file', 'app.json')).toBe('file.app.json')
    })

    it('does not double-append compound suffix', () => {
      expect(ensureWorkflowSuffix('file.app.json', 'app.json')).toBe(
        'file.app.json'
      )
    })

    it('replaces .json with .app.json when suffix is app.json', () => {
      expect(ensureWorkflowSuffix('file.json', 'app.json')).toBe(
        'file.app.json'
      )
    })

    it('replaces .app.json with .json when suffix is json', () => {
      expect(ensureWorkflowSuffix('file.app.json', 'json')).toBe('file.json')
    })

    it('handles case-insensitive extension detection', () => {
      expect(ensureWorkflowSuffix('file.JSON', 'json')).toBe('file.json')
      expect(ensureWorkflowSuffix('file.APP.JSON', 'app.json')).toBe(
        'file.app.json'
      )
    })
  })

  describe('isPreviewableMediaFilename', () => {
    it('returns true for browser-previewable core media', () => {
      expect(isPreviewableMediaFilename('image.png')).toBe(true)
      expect(isPreviewableMediaFilename('clip.mp4')).toBe(true)
      expect(isPreviewableMediaFilename('sound.wav')).toBe(true)
    })

    it('returns true for loadable 3D formats', () => {
      expect(isPreviewableMediaFilename('mesh.ply')).toBe(true)
      expect(isPreviewableMediaFilename('scene.glb')).toBe(true)
      expect(isPreviewableMediaFilename('print.stl')).toBe(true)
      expect(isPreviewableMediaFilename('points.ksplat')).toBe(true)
    })

    it('returns false for 3D media without a browser loader', () => {
      expect(isPreviewableMediaFilename('apple.usdz')).toBe(false)
    })

    it('returns false for non-previewable file types', () => {
      expect(isPreviewableMediaFilename('notes.txt')).toBe(false)
      expect(isPreviewableMediaFilename('archive.bin')).toBe(false)
    })
  })
})
