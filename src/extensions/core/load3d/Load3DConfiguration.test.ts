import { afterEach, describe, expect, it, vi } from 'vitest'

import type Load3d from '@/extensions/core/load3d/Load3d'
import Load3DConfiguration from '@/extensions/core/load3d/Load3DConfiguration'
import type {
  GizmoConfig,
  ModelConfig
} from '@/extensions/core/load3d/interfaces'
import type { Dictionary } from '@/lib/litegraph/src/interfaces'
import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn()
  })
}))

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (p: string) => p,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchCustomEvent: vi.fn(),
    fetchApi: vi.fn(),
    getSystemStats: vi.fn()
  }
}))

vi.mock('@/scripts/app', () => ({
  app: { rootGraph: { extra: {} } }
}))

vi.mock('@/extensions/core/load3d/Load3d', () => ({ default: class {} }))

vi.mock('@/extensions/core/load3d/Load3dUtils', () => ({
  default: {
    splitFilePath: vi.fn(),
    getResourceURL: vi.fn()
  }
}))

type WithPrivate = { loadModelConfig(): ModelConfig }

function createConfig(properties?: Dictionary<NodeProperty | undefined>) {
  const load3d = {} as Load3d
  return new Load3DConfiguration(load3d, properties) as unknown as WithPrivate
}

const defaultGizmo: GizmoConfig = {
  enabled: false,
  mode: 'translate',
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 }
}

describe('Load3DConfiguration.loadModelConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns full defaults including gizmo when no properties are provided', () => {
    const result = createConfig().loadModelConfig()

    expect(result).toEqual({
      upDirection: 'original',
      materialMode: 'original',
      showSkeleton: false,
      gizmo: defaultGizmo
    })
  })

  it('returns full defaults when properties do not contain Model Config', () => {
    const result = createConfig({ 'Other Key': 'x' }).loadModelConfig()

    expect(result.gizmo).toEqual(defaultGizmo)
  })

  it('adds default gizmo when Model Config exists but has no gizmo field', () => {
    const stored: ModelConfig = {
      upDirection: '+y',
      materialMode: 'wireframe',
      showSkeleton: true
    }
    const properties = { 'Model Config': stored } as Dictionary<
      NodeProperty | undefined
    >

    const result = createConfig(properties).loadModelConfig()

    expect(result.upDirection).toBe('+y')
    expect(result.materialMode).toBe('wireframe')
    expect(result.showSkeleton).toBe(true)
    expect(result.gizmo).toEqual(defaultGizmo)
  })

  it('mutates the original Model Config property to persist gizmo defaults', () => {
    const stored: ModelConfig = {
      upDirection: 'original',
      materialMode: 'original',
      showSkeleton: false
    }
    const properties = { 'Model Config': stored } as Dictionary<
      NodeProperty | undefined
    >

    createConfig(properties).loadModelConfig()

    expect((properties['Model Config'] as ModelConfig).gizmo).toEqual(
      defaultGizmo
    )
  })

  it('backfills scale on legacy gizmo config missing the scale field', () => {
    const legacyGizmo = {
      enabled: true,
      mode: 'rotate',
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0.1, y: 0.2, z: 0.3 }
    } as unknown as GizmoConfig
    const stored: ModelConfig = {
      upDirection: 'original',
      materialMode: 'original',
      showSkeleton: false,
      gizmo: legacyGizmo
    }
    const properties = { 'Model Config': stored } as Dictionary<
      NodeProperty | undefined
    >

    const result = createConfig(properties).loadModelConfig()

    expect(result.gizmo).toEqual({
      enabled: true,
      mode: 'rotate',
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0.1, y: 0.2, z: 0.3 },
      scale: { x: 1, y: 1, z: 1 }
    })
  })

  it('preserves a fully populated gizmo config unchanged', () => {
    const fullGizmo: GizmoConfig = {
      enabled: true,
      mode: 'scale',
      position: { x: 5, y: 6, z: 7 },
      rotation: { x: 1, y: 2, z: 3 },
      scale: { x: 2, y: 2, z: 2 }
    }
    const stored: ModelConfig = {
      upDirection: '-z',
      materialMode: 'normal',
      showSkeleton: false,
      gizmo: fullGizmo
    }
    const properties = { 'Model Config': stored } as Dictionary<
      NodeProperty | undefined
    >

    const result = createConfig(properties).loadModelConfig()

    expect(result.gizmo).toEqual(fullGizmo)
  })
})
