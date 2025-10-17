import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

/**
 * Test suite to verify that shim files exist in the dist folder and all exports are accessible.
 * This ensures that treeshaking doesn't break the public API exposed through shim files.
 *
 * These are static file tests that don't require the browser or ComfyUI backend to be running.
 */

// Use standard dist folder (built by CI/CD and normal builds)
// Falls back to local debug builds if available
const findDistDir = (): string | null => {
  const candidates = [
    path.join(__dirname, '../../dist'),
    path.join(__dirname, '../../dist-treeshake-enabled'),
    path.join(__dirname, '../../dist-treeshake-disabled')
  ]

  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'scripts'))) {
      return dir
    }
  }

  return null
}

const DIST_DIR = findDistDir()
const SCRIPTS_DIR = DIST_DIR ? path.join(DIST_DIR, 'scripts') : ''

// Skip these tests if dist folder doesn't exist (e.g., during development before build)
const distExists = DIST_DIR !== null

describe.skipIf(!distExists)('Shim Files Exports', () => {
  it('should find a valid dist directory', () => {
    expect(DIST_DIR).toBeTruthy()
    expect(fs.existsSync(SCRIPTS_DIR)).toBe(true)
  })

  describe('Core shim files should exist', () => {
    const coreShimFiles = [
      'api.js',
      'app.js',
      'changeTracker.js',
      'defaultGraph.js',
      'domWidget.js',
      'pnginfo.js',
      'ui.js',
      'utils.js',
      'widgets.js'
    ]

    coreShimFiles.forEach((file) => {
      it(`${file} should exist`, () => {
        const filePath = path.join(SCRIPTS_DIR, file)
        expect(fs.existsSync(filePath)).toBe(true)
      })
    })
  })

  describe('API shim file exports', () => {
    it('should contain all required exports', () => {
      const filePath = path.join(SCRIPTS_DIR, 'api.js')
      const content = fs.readFileSync(filePath, 'utf-8')

      expect(content).toContain('// Shim for scripts/api.ts')
      expect(content).toContain('export const UnauthorizedError')
      expect(content).toContain('export const PromptExecutionError')
      expect(content).toContain('export const ComfyApi')
      expect(content).toContain('export const api')
      expect(content).toContain('window.comfyAPI.api')
    })
  })

  describe('App shim file exports', () => {
    it('should contain all required exports', () => {
      const filePath = path.join(SCRIPTS_DIR, 'app.js')
      const content = fs.readFileSync(filePath, 'utf-8')

      expect(content).toContain('// Shim for scripts/app.ts')
      expect(content).toContain('export const ANIM_PREVIEW_WIDGET')
      expect(content).toContain('export const ComfyApp')
      expect(content).toContain('export const app')
      expect(content).toContain('window.comfyAPI.app')
    })
  })

  describe('ChangeTracker shim file exports', () => {
    it('should contain all required exports', () => {
      const filePath = path.join(SCRIPTS_DIR, 'changeTracker.js')
      const content = fs.readFileSync(filePath, 'utf-8')

      expect(content).toContain('// Shim for scripts/changeTracker.ts')
      expect(content).toContain('export const ChangeTracker')
      expect(content).toContain('window.comfyAPI.changeTracker')
    })
  })

  describe('DefaultGraph shim file exports', () => {
    it('should contain all required exports', () => {
      const filePath = path.join(SCRIPTS_DIR, 'defaultGraph.js')
      const content = fs.readFileSync(filePath, 'utf-8')

      expect(content).toContain('// Shim for scripts/defaultGraph.ts')
      expect(content).toContain('export const defaultGraph')
      expect(content).toContain('export const defaultGraphJSON')
      expect(content).toContain('export const blankGraph')
      expect(content).toContain('window.comfyAPI.defaultGraph')
    })
  })

  describe('DomWidget shim file exports', () => {
    it('should contain all required exports', () => {
      const filePath = path.join(SCRIPTS_DIR, 'domWidget.js')
      const content = fs.readFileSync(filePath, 'utf-8')

      expect(content).toContain('// Shim for scripts/domWidget.ts')
      expect(content).toContain('export const isDOMWidget')
      expect(content).toContain('export const isComponentWidget')
      expect(content).toContain('export const DOMWidgetImpl')
      expect(content).toContain('export const ComponentWidgetImpl')
      expect(content).toContain('export const addWidget')
      expect(content).toContain('window.comfyAPI.domWidget')
    })
  })

  describe('Pnginfo shim file exports', () => {
    it('should contain all required exports', () => {
      const filePath = path.join(SCRIPTS_DIR, 'pnginfo.js')
      const content = fs.readFileSync(filePath, 'utf-8')

      expect(content).toContain('// Shim for scripts/pnginfo.ts')
      expect(content).toContain('export const getPngMetadata')
      expect(content).toContain('export const getFlacMetadata')
      expect(content).toContain('export const getAvifMetadata')
      expect(content).toContain('export const getWebpMetadata')
      expect(content).toContain('export const getLatentMetadata')
      expect(content).toContain('export const importA1111')
      expect(content).toContain('window.comfyAPI.pnginfo')
    })
  })

  describe('UI shim file exports', () => {
    it('should contain all required exports', () => {
      const filePath = path.join(SCRIPTS_DIR, 'ui.js')
      const content = fs.readFileSync(filePath, 'utf-8')

      expect(content).toContain('// Shim for scripts/ui.ts')
      expect(content).toContain('export const ComfyDialog')
      expect(content).toContain('export const $el')
      expect(content).toContain('export const ComfyUI')
      expect(content).toContain('window.comfyAPI.ui')
    })
  })

  describe('Utils shim file exports', () => {
    it('should contain all required exports', () => {
      const filePath = path.join(SCRIPTS_DIR, 'utils.js')
      const content = fs.readFileSync(filePath, 'utf-8')

      expect(content).toContain('// Shim for scripts/utils.ts')
      expect(content).toContain('export const clone')
      expect(content).toContain('export const applyTextReplacements')
      expect(content).toContain('export const addStylesheet')
      expect(content).toContain('export const downloadBlob')
      expect(content).toContain('export const uploadFile')
      expect(content).toContain('export const prop')
      expect(content).toContain('export const getStorageValue')
      expect(content).toContain('export const setStorageValue')
      expect(content).toContain('window.comfyAPI.utils')
    })
  })

  describe('Widgets shim file exports', () => {
    it('should contain all required exports', () => {
      const filePath = path.join(SCRIPTS_DIR, 'widgets.js')
      const content = fs.readFileSync(filePath, 'utf-8')

      expect(content).toContain('// Shim for scripts/widgets.ts')
      expect(content).toContain('export const updateControlWidgetLabel')
      expect(content).toContain('export const IS_CONTROL_WIDGET')
      expect(content).toContain('export const addValueControlWidget')
      expect(content).toContain('export const addValueControlWidgets')
      expect(content).toContain('export const ComfyWidgets')
      expect(content).toContain('window.comfyAPI.widgets')
    })
  })

  describe('UI subdirectory shim files', () => {
    const uiShimFiles = [
      'ui/components/asyncDialog.js',
      'ui/components/button.js',
      'ui/components/buttonGroup.js',
      'ui/components/popup.js',
      'ui/components/splitButton.js',
      'ui/dialog.js',
      'ui/draggableList.js',
      'ui/imagePreview.js',
      'ui/menu/index.js',
      'ui/settings.js',
      'ui/toggleSwitch.js',
      'ui/utils.js'
    ]

    uiShimFiles.forEach((file) => {
      it(`${file} should exist`, () => {
        const filePath = path.join(SCRIPTS_DIR, file)
        expect(fs.existsSync(filePath)).toBe(true)
      })

      it(`${file} should be a valid shim file`, () => {
        const filePath = path.join(SCRIPTS_DIR, file)
        const content = fs.readFileSync(filePath, 'utf-8')
        expect(content).toContain('window.comfyAPI')
        expect(content).toContain('export const')
      })
    })
  })

  describe('Metadata subdirectory shim files', () => {
    const metadataShimFiles = [
      'metadata/avif.js',
      'metadata/ebml.js',
      'metadata/flac.js',
      'metadata/gltf.js',
      'metadata/isobmff.js',
      'metadata/mp3.js',
      'metadata/ogg.js',
      'metadata/png.js',
      'metadata/svg.js'
    ]

    metadataShimFiles.forEach((file) => {
      it(`${file} should exist`, () => {
        const filePath = path.join(SCRIPTS_DIR, file)
        expect(fs.existsSync(filePath)).toBe(true)
      })

      it(`${file} should be a valid shim file`, () => {
        const filePath = path.join(SCRIPTS_DIR, file)
        const content = fs.readFileSync(filePath, 'utf-8')
        expect(content).toContain('window.comfyAPI')
        expect(content).toContain('export const')
      })
    })
  })
})
