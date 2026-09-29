import { describe, expect, it } from 'vitest'

import { DEFAULT_CAMERA } from '../reshoot'
import type { ReshootShot } from './workflow'
import { analyzeWorkflow, generateWorkflow } from './workflow'

const clip = { video: 'clip.mp4', aspect: '9:16', size: '768p' } as const

const shot: ReshootShot = {
  clip,
  camera: { ...DEFAULT_CAMERA, azimuth: 20, fov: 60 },
  keepAim: false,
  pivot: [0.1, 0.2, 1.5],
  keys: [],
  motion: 'smooth',
  prompt: '  a stone wall ',
  seed: 7
}

describe('Re-shoot graphs', () => {
  it('binds the clip, framing and size to both stages', () => {
    for (const graph of [analyzeWorkflow(clip), generateWorkflow(shot)]) {
      expect(graph['1'].inputs.file).toBe('clip.mp4')
      expect(graph['2'].inputs).toMatchObject({
        aspect_ratio: '9:16',
        megapixels: 1,
        duration: 15
      })
    }
  })

  it('analyzes with only the nodes the app proxy runs unmetered', () => {
    const classes = new Set(
      Object.values(analyzeWorkflow(clip)).map((node) => node.class_type)
    )
    expect([...classes].sort()).toEqual([
      'CrossViewGeometryExport',
      'CrossViewPrepareClip',
      'LoadMoGeModel',
      'LoadVideo',
      'MoGeInference'
    ])
  })

  it('aims the warp at the pivot the page found', () => {
    const graph = generateWorkflow(shot)
    expect(graph['5'].inputs).toMatchObject({
      azimuth: 20,
      hfov: 60,
      pivot_override: true,
      pivot_x: 0.1,
      pivot_z: 1.5,
      keep_source_aim: false,
      use_keyframes: false,
      keyframes: ''
    })
    expect(graph['20'].inputs.prompt).toBe('crossview. a stone wall')
    expect(graph['30'].inputs.noise_seed).toBe(7)
  })

  it('sends a keyed move with frames counted from 1', () => {
    const graph = generateWorkflow({
      ...shot,
      keys: [
        { frame: 0, camera: DEFAULT_CAMERA },
        { frame: 47, camera: { ...DEFAULT_CAMERA, azimuth: 40 } }
      ]
    })
    expect(graph['5'].inputs.use_keyframes).toBe(true)
    expect(JSON.parse(String(graph['5'].inputs.keyframes))).toEqual([
      { f: 1, az: -30, el: 15, dist: 1, vs: 0, px: 0.1, py: 0.2, pz: 1.5 },
      { f: 48, az: 40, el: 15, dist: 1, vs: 0, px: 0.1, py: 0.2, pz: 1.5 }
    ])
  })
})
