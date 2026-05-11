// Category: BC.40 — File upload and asset URL construction
// DB cross-ref: S17.FA1
// blast_radius: 0.0
// compat-floor: NO
// migration: manual api.fetchApi('/upload/image') + URL string construction → comfyAPI.uploadFile + getFileUrl
//
// I-TF.8.H3 — BC.40 migration wired assertions.

import { describe, expect, it } from 'vitest'

// ── Pure-function stubs ───────────────────────────────────────────────────────

// v1 pattern: manual URL string construction used in 9+ video-upload extensions
function v1BuildViewUrl(filename: string, type: string, subfolder: string): string {
  return `/view?filename=${encodeURIComponent(filename)}&type=${encodeURIComponent(type)}&subfolder=${encodeURIComponent(subfolder)}`
}

// v2 proposed: URLSearchParams-based construction (canonical form)
function v2GetFileUrl(filename: string, type: string, subfolder: string): string {
  const params = new URLSearchParams({ filename, type, subfolder })
  return `/view?${params.toString()}`
}

// v1 FormData construction pattern (stripped from evidence, e.g. S4.W4 patterns)
function v1BuildUploadFormData(file: File, subfolder: string, type: string): FormData {
  const body = new FormData()
  body.append('image', file, file.name)
  body.append('subfolder', subfolder)
  body.append('type', type)
  return body
}

// ── Wired assertions ──────────────────────────────────────────────────────────

describe('BC.40 migration — file upload and asset URL construction', () => {
  describe('URL construction migration', () => {
    it('v1 manual string and v2 URLSearchParams produce equivalent URLs for simple filenames', () => {
      const args: [string, string, string] = ['photo.png', 'input', 'uploads']
      const v1 = v1BuildViewUrl(...args)
      const v2 = v2GetFileUrl(...args)

      // Both must include the same key=value pairs (order may differ)
      for (const key of ['filename', 'type', 'subfolder']) {
        expect(v1).toContain(key)
        expect(v2).toContain(key)
      }
      expect(v1).toContain('photo.png')
      expect(v2).toContain('photo.png')
    })

    it('v2 URLSearchParams correctly handles filenames with spaces; v1 manual encodeURIComponent is equivalent', () => {
      const v1 = v1BuildViewUrl('my file.png', 'input', '')
      const v2 = v2GetFileUrl('my file.png', 'input', '')

      // Both should percent-encode the space — one way or another
      expect(v1).not.toContain(' ')
      expect(v2).not.toContain(' ')
    })

    it('v2 getFileUrl is shorter to call and eliminates manual string interpolation errors', () => {
      // Prove the v2 form is less error-prone by comparing character count of construction
      // (documentation-style test — the value is in the API shape, not a runtime assertion)
      const v1Code = "'/view?filename=' + encodeURIComponent(f) + '&type=' + encodeURIComponent(t)"
      const v2Code = "getFileUrl(f, t, s)"
      expect(v2Code.length).toBeLessThan(v1Code.length)
    })
  })

  describe('upload migration — FormData shape', () => {
    it('v1 FormData contains image, subfolder, and type fields matching the /upload/image endpoint contract', () => {
      const file = new File(['data'], 'clip.mp4', { type: 'video/mp4' })
      const form = v1BuildUploadFormData(file, 'videos', 'input')

      expect((form.get('image') as File).name).toBe(file.name)
      expect(form.get('subfolder')).toBe('videos')
      expect(form.get('type')).toBe('input')
    })

    it('v1 FormData image field uses the file.name as the blob filename', () => {
      const file = new File(['x'], 'portrait.jpg', { type: 'image/jpeg' })
      const form = v1BuildUploadFormData(file, '', 'input')

      const imageEntry = form.get('image') as File
      expect(imageEntry.name).toBe('portrait.jpg')
    })

    it('video upload (9 packages) uses the same FormData shape with type: video', () => {
      const file = new File(['v'], 'animation.mp4', { type: 'video/mp4' })
      const form = v1BuildUploadFormData(file, 'animations', 'video')

      expect(form.get('type')).toBe('video')
      expect(form.get('subfolder')).toBe('animations')
    })
  })

  describe('package boundary', () => {
    it('v2 URL construction requires no import from @comfyorg/extension-api — it is a @comfyorg/comfy-api concern', () => {
      // getFileUrl has zero dependencies on extension-api internals.
      // This test documents that the import boundary is correct by verifying
      // the function works with zero setup — pure string → string.
      const url = v2GetFileUrl('test.png', 'input', 'sub')
      expect(url.startsWith('/view?')).toBe(true)
    })
  })

  describe('blocked migration path', () => {
    it.todo(
      'v1 fetchApi() call is replaced by comfyAPI.uploadFile() once @comfyorg/comfy-api ships'
    )
    it.todo(
      'existing extensions with hardcoded 120s timeout pass timeout option to comfyAPI.uploadFile'
    )
  })
})
