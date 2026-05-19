import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ModelExporter } from './ModelExporter'

const {
  downloadBlobMock,
  addAlertMock,
  gltfParseMock,
  objParseMock,
  stlParseMock
} = vi.hoisted(() => ({
  downloadBlobMock: vi.fn(),
  addAlertMock: vi.fn(),
  gltfParseMock: vi.fn(),
  objParseMock: vi.fn(),
  stlParseMock: vi.fn()
}))

vi.mock('@/base/common/downloadUtil', () => ({
  downloadBlob: downloadBlobMock
}))

vi.mock('@/i18n', () => ({
  t: (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ addAlert: addAlertMock })
}))

vi.mock('three/examples/jsm/exporters/GLTFExporter', () => ({
  GLTFExporter: class {
    parse = gltfParseMock
  }
}))

vi.mock('three/examples/jsm/exporters/OBJExporter', () => ({
  OBJExporter: class {
    parse = objParseMock
  }
}))

vi.mock('three/examples/jsm/exporters/STLExporter', () => ({
  STLExporter: class {
    parse = stlParseMock
  }
}))

describe('ModelExporter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('detectFormatFromURL', () => {
    it('extracts the lowercase extension from the filename query parameter', () => {
      expect(
        ModelExporter.detectFormatFromURL(
          'http://example.com/api/view?filename=model.GLB'
        )
      ).toBe('glb')
    })

    it('returns null when there is no filename parameter', () => {
      expect(
        ModelExporter.detectFormatFromURL('http://example.com/api/view?foo=bar')
      ).toBeNull()
    })

    it('returns null when there is no query string at all', () => {
      expect(
        ModelExporter.detectFormatFromURL('http://example.com/file.glb')
      ).toBeNull()
    })

    it('returns the whole basename when the filename has no dotted extension', () => {
      // split('.').pop() returns the only segment when no dot is present.
      expect(
        ModelExporter.detectFormatFromURL(
          'http://example.com/api/view?filename=cube'
        )
      ).toBe('cube')
    })
  })

  describe('canUseDirectURL', () => {
    it('returns false for a null URL', () => {
      expect(ModelExporter.canUseDirectURL(null, 'glb')).toBe(false)
    })

    it('returns true when the URL extension matches the requested format (case-insensitive)', () => {
      expect(
        ModelExporter.canUseDirectURL(
          'http://example.com/api/view?filename=cube.GLB',
          'glb'
        )
      ).toBe(true)
    })

    it('returns false when the URL extension does not match', () => {
      expect(
        ModelExporter.canUseDirectURL(
          'http://example.com/api/view?filename=cube.obj',
          'glb'
        )
      ).toBe(false)
    })

    it('returns false when the URL has no detectable format', () => {
      expect(
        ModelExporter.canUseDirectURL('http://example.com/file.glb', 'glb')
      ).toBe(false)
    })
  })

  describe('downloadFromURL', () => {
    it('fetches the URL and downloads the resulting blob', async () => {
      const blob = new Blob(['x'])
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) })
      )

      await ModelExporter.downloadFromURL(
        'http://example.com/cube.glb',
        'cube.glb'
      )

      expect(downloadBlobMock).toHaveBeenCalledWith('cube.glb', blob)
      vi.unstubAllGlobals()
    })

    it('rethrows and shows a toast alert when fetch fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

      await expect(
        ModelExporter.downloadFromURL('http://example.com/cube.glb', 'cube.glb')
      ).rejects.toThrow('network')
      expect(addAlertMock).toHaveBeenCalledWith(
        'toastMessages.failedToDownloadFile'
      )
      vi.unstubAllGlobals()
    })
  })

  describe('exportGLB', () => {
    it('takes the direct-URL fast path when the original URL is already a .glb', async () => {
      const blob = new Blob(['x'])
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) })
      )
      const model = new THREE.Object3D()

      await ModelExporter.exportGLB(
        model,
        'out.glb',
        'http://example.com/api/view?filename=src.glb'
      )

      expect(downloadBlobMock).toHaveBeenCalledWith('out.glb', blob)
      expect(gltfParseMock).not.toHaveBeenCalled()
      vi.unstubAllGlobals()
    })

    it('falls through to GLTFExporter when there is no direct URL', async () => {
      gltfParseMock.mockImplementation(
        (
          _model: unknown,
          onDone: (gltf: ArrayBuffer) => void,
          _onError: unknown,
          options: { binary: boolean }
        ) => {
          expect(options.binary).toBe(true)
          onDone(new ArrayBuffer(8))
        }
      )

      const promise = ModelExporter.exportGLB(new THREE.Object3D(), 'out.glb')
      await vi.runAllTimersAsync()
      await promise

      expect(gltfParseMock).toHaveBeenCalled()
      expect(downloadBlobMock).toHaveBeenCalledWith('out.glb', expect.any(Blob))
    })

    it('alerts and rethrows when GLTFExporter rejects', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      gltfParseMock.mockImplementation(
        (_model: unknown, _onDone: unknown, onError: (e: Error) => void) =>
          onError(new Error('parse fail'))
      )

      const promise = ModelExporter.exportGLB(new THREE.Object3D(), 'out.glb')
      const assertion = expect(promise).rejects.toThrow('parse fail')
      await vi.runAllTimersAsync()
      await assertion
      expect(addAlertMock).toHaveBeenCalledWith(
        'toastMessages.failedToExportModel:{"format":"GLB"}'
      )
    })
  })

  describe('exportOBJ', () => {
    it('uses the direct-URL fast path for matching .obj URLs', async () => {
      const blob = new Blob(['x'])
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) })
      )

      await ModelExporter.exportOBJ(
        new THREE.Object3D(),
        'out.obj',
        'http://example.com/api/view?filename=src.obj'
      )

      expect(downloadBlobMock).toHaveBeenCalledWith('out.obj', blob)
      expect(objParseMock).not.toHaveBeenCalled()
      vi.unstubAllGlobals()
    })

    it('serializes via OBJExporter and downloads as text when there is no direct URL', async () => {
      objParseMock.mockReturnValue('# obj data')

      const promise = ModelExporter.exportOBJ(new THREE.Object3D(), 'out.obj')
      await vi.runAllTimersAsync()
      await promise

      expect(objParseMock).toHaveBeenCalled()
      expect(downloadBlobMock).toHaveBeenCalledWith('out.obj', expect.any(Blob))
    })

    it('alerts and rethrows when OBJExporter throws', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      objParseMock.mockImplementation(() => {
        throw new Error('obj fail')
      })

      const promise = ModelExporter.exportOBJ(new THREE.Object3D(), 'out.obj')
      const assertion = expect(promise).rejects.toThrow('obj fail')
      await vi.runAllTimersAsync()
      await assertion
      expect(addAlertMock).toHaveBeenCalledWith(
        'toastMessages.failedToExportModel:{"format":"OBJ"}'
      )
    })
  })

  describe('exportSTL', () => {
    it('uses the direct-URL fast path for matching .stl URLs', async () => {
      const blob = new Blob(['x'])
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) })
      )

      await ModelExporter.exportSTL(
        new THREE.Object3D(),
        'out.stl',
        'http://example.com/api/view?filename=src.stl'
      )

      expect(downloadBlobMock).toHaveBeenCalledWith('out.stl', blob)
      expect(stlParseMock).not.toHaveBeenCalled()
      vi.unstubAllGlobals()
    })

    it('serializes via STLExporter and downloads as text when there is no direct URL', async () => {
      stlParseMock.mockReturnValue('solid model')

      const promise = ModelExporter.exportSTL(new THREE.Object3D(), 'out.stl')
      await vi.runAllTimersAsync()
      await promise

      expect(stlParseMock).toHaveBeenCalled()
      expect(downloadBlobMock).toHaveBeenCalledWith('out.stl', expect.any(Blob))
    })

    it('alerts and rethrows when STLExporter throws', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      stlParseMock.mockImplementation(() => {
        throw new Error('stl fail')
      })

      const promise = ModelExporter.exportSTL(new THREE.Object3D(), 'out.stl')
      const assertion = expect(promise).rejects.toThrow('stl fail')
      await vi.runAllTimersAsync()
      await assertion
      expect(addAlertMock).toHaveBeenCalledWith(
        'toastMessages.failedToExportModel:{"format":"STL"}'
      )
    })
  })
})
