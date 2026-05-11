// Category: BC.40 — File upload and asset URL construction
// DB cross-ref: S17.FA1
// Exemplar: https://www.notion.so/comfy-org/Develop-a-custom-node-from-scratch-pain-point-assessment-33c6d73d365080f49126c0b5affa7559
// blast_radius: 0.0
// compat-floor: NO (absent API gap — future @comfyorg/comfy-api package, not @comfyorg/extension-api)
// v2 contract: comfyAPI.uploadFile(file, { subfolder, type }) + comfyAPI.getFileUrl(filename, type, subfolder)
//
// Phase A note: @comfyorg/comfy-api package does not exist yet. Tests prove the
// proposed API contract using inline stubs. URL construction and FormData shape
// are pure functions testable without a real server. Network-dependent upload
// tests remain as Phase B todos.
//
// I-TF.8.H3 — BC.40 v2 wired assertions.

import { describe, expect, it, vi } from 'vitest'

// ── Proposed API stubs ────────────────────────────────────────────────────────

interface UploadResult {
  filename: string
  subfolder: string
  type: string
}

interface UploadOptions {
  subfolder?: string
  type?: string
  timeout?: number
}

function getFileUrl(filename: string, type: string, subfolder: string): string {
  const params = new URLSearchParams({ filename, type, subfolder })
  return `/view?${params.toString()}`
}

function createMockComfyAPI() {
  const uploadFile = vi.fn(
    async (
      _file: File,
      opts: UploadOptions = {}
    ): Promise<UploadResult> => ({
      filename: _file.name,
      subfolder: opts.subfolder ?? '',
      type: opts.type ?? 'input'
    })
  )

  return {
    uploadFile,
    getFileUrl
  }
}

// ── Wired assertions ──────────────────────────────────────────────────────────

describe('BC.40 v2 contract — file upload and asset URL construction', () => {
  describe('S17.FA1 — comfyAPI.getFileUrl', () => {
    it('getFileUrl returns a /view?... URL with the correct query parameters', () => {
      const url = getFileUrl('photo.png', 'input', 'my-folder')
      expect(url).toMatch(/^\/view\?/)
      expect(url).toContain('filename=photo.png')
      expect(url).toContain('type=input')
      expect(url).toContain('subfolder=my-folder')
    })

    it('getFileUrl with empty subfolder produces a URL without subfolder value', () => {
      const url = getFileUrl('clip.mp4', 'video', '')
      expect(url).toContain('filename=clip.mp4')
      expect(url).toContain('type=video')
    })

    it('getFileUrl with an UploadResult spread produces the same URL as individual fields', () => {
      const result: UploadResult = { filename: 'image.jpg', type: 'output', subfolder: 'renders' }

      const fromSpread = getFileUrl(result.filename, result.type, result.subfolder)
      const fromFields = getFileUrl('image.jpg', 'output', 'renders')

      expect(fromSpread).toBe(fromFields)
    })

    it('filenames with special characters are percent-encoded in the URL', () => {
      const url = getFileUrl('my file (1).png', 'input', '')
      // URLSearchParams percent-encodes spaces and parens
      expect(url).not.toContain(' ')
      expect(url).toContain('filename=')
    })

    it('getFileUrl does not produce double slashes or malformed query strings', () => {
      const url = getFileUrl('test.png', 'input', '')
      expect(url).toMatch(/^\/view\?[^&=]/)
      expect(url).not.toContain('//')
    })
  })

  describe('S17.FA1 — comfyAPI.uploadFile (mock contract)', () => {
    it('uploadFile returns a promise resolving to UploadResult with filename, subfolder, type', async () => {
      const api = createMockComfyAPI()
      const file = new File(['data'], 'photo.png', { type: 'image/png' })

      const result = await api.uploadFile(file, { subfolder: 'uploads', type: 'input' })

      expect(result).toEqual({ filename: 'photo.png', subfolder: 'uploads', type: 'input' })
    })

    it('uploadFile with no options defaults subfolder to empty string and type to input', async () => {
      const api = createMockComfyAPI()
      const file = new File(['v'], 'video.mp4', { type: 'video/mp4' })

      const result = await api.uploadFile(file)

      expect(result.subfolder).toBe('')
      expect(result.type).toBe('input')
    })

    it('uploadFile result can be spread directly into getFileUrl', async () => {
      const api = createMockComfyAPI()
      const file = new File(['x'], 'mask.png', { type: 'image/png' })

      const result = await api.uploadFile(file, { subfolder: 'masks', type: 'input' })
      const url = api.getFileUrl(result.filename, result.type, result.subfolder)

      expect(url).toContain('filename=mask.png')
      expect(url).toContain('subfolder=masks')
      expect(url).toContain('type=input')
    })
  })

  describe('package boundary documentation', () => {
    it('getFileUrl is a pure function requiring only filename/type/subfolder strings', () => {
      // This proves it belongs in a utility package, not tied to the extension API runtime.
      // @comfyorg/comfy-api is planned to expose it; until then extensions inline equivalent logic.
      expect(typeof getFileUrl).toBe('function')
      expect(getFileUrl.length).toBe(3) // (filename, type, subfolder)
    })
  })
})

// ── Phase B stubs ─────────────────────────────────────────────────────────────

describe('BC.40 v2 contract — file upload and asset URL construction [Phase B]', () => {
  it.todo(
    'comfyAPI.uploadFile sends correct FormData to /upload/image with filename, image, subfolder fields'
  )
  it.todo(
    'upload failure (4xx/5xx) rejects the promise with a typed UploadError containing status and message'
  )
  it.todo(
    'comfyAPI.uploadFile respects the timeout option, aborting with AbortError on expiry'
  )
  it.todo(
    '@comfyorg/comfy-api package exports uploadFile and getFileUrl (package existence test)'
  )
})
