// Category: BC.40 — File upload and asset URL construction
// DB cross-ref: S17.FA1
// Exemplar: https://www.notion.so/comfy-org/Develop-a-custom-node-from-scratch-pain-point-assessment-33c6d73d365080f49126c0b5affa7559
// blast_radius: 0.0
// compat-floor: NO (absent API gap — out of scope for @comfyorg/extension-api;
//               belongs in future @comfyorg/comfy-api package)
// v1 contract: each extension manually builds FormData, calls api.fetchApi('/upload/image', ...),
//              constructs /view?filename=... URL
// Note: 32+ packages affected; 9 implement video upload variants.
//       Upload timeout hardcoded 120s; large 3D/video fail silently. No temp file lifecycle.

import { describe, expect, it } from 'vitest'

// v1 URL construction helper — the pattern every extension must duplicate manually
function buildViewUrl(filename: string, subfolder: string, type: string): string {
  const params = new URLSearchParams({ filename, subfolder, type })
  return `/view?${params.toString()}`
}

// Synthetic upload response (matches ComfyUI /upload/image response shape)
interface UploadResponse {
  name: string
  subfolder: string
  type: string
}

// Minimal FormData shape check
function buildUploadFormData(file: Blob, filename: string, subfolder: string, type: string): FormData {
  const fd = new FormData()
  fd.append('image', file, filename)
  fd.append('subfolder', subfolder)
  fd.append('type', type)
  return fd
}

describe('BC.40 v1 contract — file upload and asset URL construction', () => {
  describe('S17.FA1 — manual FormData and fetchApi upload', () => {
    it('extension constructs a FormData with file, filename, subfolder, and type fields', () => {
      const file = new Blob(['fake-image-data'], { type: 'image/png' })
      const fd = buildUploadFormData(file, 'texture.png', 'models/3d', 'input')

      expect(fd.get('subfolder')).toBe('models/3d')
      expect(fd.get('type')).toBe('input')
      // image field is set (Blob + filename)
      const imageEntry = fd.get('image')
      expect(imageEntry).not.toBeNull()
    })

    it('upload response JSON contains filename, subfolder, and type fields for URL construction', () => {
      // Synthetic response that matches the /upload/image endpoint
      const response: UploadResponse = {
        name: 'texture.png',
        subfolder: 'models/3d',
        type: 'input',
      }

      expect(response.name).toBe('texture.png')
      expect(response.subfolder).toBe('models/3d')
      expect(response.type).toBe('input')
    })

    it('each extension constructs a separate FormData — no shared upload helper exists in v1', () => {
      // Two extensions both building FormData independently with slight variations
      const file = new Blob(['data'])

      const fdA = new FormData()
      fdA.append('image', file, 'asset.png')
      fdA.append('type', 'temp')

      const fdB = new FormData()
      fdB.append('image', file, 'asset.png')
      fdB.append('type', 'input')  // different default type — common v1 inconsistency

      expect(fdA.get('type')).toBe('temp')
      expect(fdB.get('type')).toBe('input')
      // Same file, two different upload forms — no standardized API in v1
    })
  })

  describe('S17.FA1 — manual /view URL construction', () => {
    it("extension constructs retrieval URL as '/view?filename=...&type=...&subfolder=...' from upload response", () => {
      const response: UploadResponse = { name: 'scene.glb', subfolder: 'models', type: 'input' }
      const url = buildViewUrl(response.name, response.subfolder, response.type)

      expect(url).toContain('/view?')
      expect(url).toContain('filename=scene.glb')
      expect(url).toContain('subfolder=models')
      expect(url).toContain('type=input')
    })

    it('URL construction with empty subfolder produces a valid URL without trailing separator', () => {
      const url = buildViewUrl('output.png', '', 'output')
      expect(url).toContain('filename=output.png')
      expect(url).toContain('type=output')
      expect(url).not.toContain('undefined')
    })

    it('special characters in filename are percent-encoded in the URL', () => {
      const url = buildViewUrl('my file (1).png', '', 'input')
      expect(url).not.toContain(' ')
      expect(url).toContain('my+file+%281%29.png')
    })
  })
})
