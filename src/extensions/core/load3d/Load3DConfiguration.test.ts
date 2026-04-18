import { beforeEach, describe, expect, it, vi } from 'vitest'

import Load3DConfiguration from '@/extensions/core/load3d/Load3DConfiguration'
import type {
  CameraConfig,
  SceneConfig
} from '@/extensions/core/load3d/interfaces'
import type { Dictionary } from '@/lib/litegraph/src/interfaces'
import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'

const mockGet = vi.hoisted(() => vi.fn())

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: mockGet })
}))

vi.mock('@/scripts/api', () => ({
  api: { apiURL: vi.fn((p: string) => p) }
}))

vi.mock('@/extensions/core/load3d/Load3dUtils', () => ({
  default: {
    getResourceURL: vi.fn(() => '/test'),
    splitFilePath: vi.fn(() => ['', 'test.glb']),
    getFilenameExtension: vi.fn(() => 'glb')
  }
}))

function makeLoad3dMock() {
  return {
    toggleGrid: vi.fn(),
    setBackgroundColor: vi.fn(),
    toggleCamera: vi.fn(),
    setFOV: vi.fn(),
    setLightIntensity: vi.fn()
  } as unknown as InstanceType<
    typeof import('@/extensions/core/load3d/Load3d').default
  >
}

function defaultSettings(overrides: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    'Comfy.Load3D.ShowGrid': true,
    'Comfy.Load3D.BackgroundColor': '000000',
    'Comfy.Load3D.CameraType': 'perspective',
    'Comfy.Load3D.LightIntensity': 1
  }
  return { ...base, ...overrides }
}

describe('Load3DConfiguration — setupDefaultProperties persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function configure(
    properties: Dictionary<NodeProperty | undefined>,
    settingOverrides: Record<string, unknown> = {}
  ) {
    const settings = defaultSettings(settingOverrides)
    mockGet.mockImplementation((key: string) => settings[key])
    const config = new Load3DConfiguration(makeLoad3dMock(), properties)
    config.configureForSaveMesh('input', '')
  }

  describe('Scene Config', () => {
    it('writes Scene Config from settings when property is absent', () => {
      const properties: Dictionary<NodeProperty | undefined> = {}
      configure(properties, {
        'Comfy.Load3D.ShowGrid': false,
        'Comfy.Load3D.BackgroundColor': 'ff4400'
      })

      const scene = properties['Scene Config'] as SceneConfig
      expect(scene).toBeDefined()
      expect(scene.showGrid).toBe(false)
      expect(scene.backgroundColor).toBe('#ff4400')
    })

    it('does not overwrite existing Scene Config', () => {
      const existing: SceneConfig = {
        showGrid: true,
        backgroundColor: '#aabbcc',
        backgroundImage: ''
      }
      const properties: Dictionary<NodeProperty | undefined> = {
        'Scene Config': existing
      }
      configure(properties, { 'Comfy.Load3D.ShowGrid': false })

      expect(properties['Scene Config']).toBe(existing)
      expect((properties['Scene Config'] as SceneConfig).showGrid).toBe(true)
    })
  })

  describe('Camera Config', () => {
    it('writes Camera Config from settings when property is absent', () => {
      const properties: Dictionary<NodeProperty | undefined> = {}
      configure(properties, { 'Comfy.Load3D.CameraType': 'orthographic' })

      const camera = properties['Camera Config'] as CameraConfig
      expect(camera).toBeDefined()
      expect(camera.cameraType).toBe('orthographic')
    })

    it('does not overwrite existing Camera Config', () => {
      const existing: CameraConfig = { cameraType: 'perspective', fov: 60 }
      const properties: Dictionary<NodeProperty | undefined> = {
        'Camera Config': existing
      }
      configure(properties, { 'Comfy.Load3D.CameraType': 'orthographic' })

      expect(properties['Camera Config']).toBe(existing)
      expect((properties['Camera Config'] as CameraConfig).cameraType).toBe(
        'perspective'
      )
    })
  })
})
