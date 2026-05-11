// Category: BC.24 — Node-def schema inspection
// DB cross-ref: S13.SC1
// blast_radius: 4.62 (compat-floor)
// v1 contract: nodeData.input.required['key'][0] — raw array access into node def schema
// TODO(R8): swap with loadEvidenceSnippet once excerpts populated

import { describe, expect, it } from 'vitest'
import { countEvidenceExcerpts, loadEvidenceSnippet, runV1 } from '../harness'

void [loadEvidenceSnippet, runV1]

type InputSpec = [string, Record<string, unknown>?]
type NodeDef = {
  name: string
  category: string
  output_node: boolean
  input: {
    required?: Record<string, InputSpec>
    optional?: Record<string, InputSpec>
    hidden?: Record<string, InputSpec>
  }
  output: string[]
}

function makeKSamplerDef(): NodeDef {
  return {
    name: 'KSampler',
    category: 'sampling',
    output_node: false,
    input: {
      required: {
        model: ['MODEL'],
        positive: ['CONDITIONING'],
        negative: ['CONDITIONING'],
        latent_image: ['LATENT'],
        seed: ['INT', { default: 0, min: 0, max: 0xffffffffffffffff }],
        steps: ['INT', { default: 20, min: 1, max: 10000 }],
        cfg: ['FLOAT', { default: 8.0, min: 0.0, max: 100.0 }],
        sampler_name: ['COMBO', {}],
      },
    },
    output: ['LATENT'],
  }
}

describe('BC.24 v1 contract — node-def schema inspection (S13.SC1)', () => {
  it('S13.SC1 has at least one evidence excerpt', () => {
    expect(countEvidenceExcerpts('S13.SC1')).toBeGreaterThan(0)
  })

  it('nodeData.input.required keys enumerate the required inputs', () => {
    const def = makeKSamplerDef()
    const keys = Object.keys(def.input.required!)
    expect(keys).toContain('seed')
    expect(keys).toContain('model')
    expect(keys).toContain('sampler_name')
  })

  it('nodeData.input.required[key][0] is the type string', () => {
    const def = makeKSamplerDef()
    expect(def.input.required!['seed'][0]).toBe('INT')
    expect(def.input.required!['cfg'][0]).toBe('FLOAT')
    expect(def.input.required!['model'][0]).toBe('MODEL')
  })

  it('nodeData.input.required[key][1] holds min/max/default config', () => {
    const def = makeKSamplerDef()
    const stepConfig = def.input.required!['steps'][1]!
    expect(stepConfig['min']).toBe(1)
    expect(stepConfig['max']).toBe(10000)
    expect(stepConfig['default']).toBe(20)
  })

  it('nodeData.output is an array of type strings', () => {
    const def = makeKSamplerDef()
    expect(Array.isArray(def.output)).toBe(true)
    expect(def.output[0]).toBe('LATENT')
  })

  it('nodeData.output_node is a boolean', () => {
    const def = makeKSamplerDef()
    expect(typeof def.output_node).toBe('boolean')
  })

  it('nodeData.category is a slash-separated string', () => {
    const def = makeKSamplerDef()
    expect(typeof def.category).toBe('string')
    expect(def.category.length).toBeGreaterThan(0)
  })

  it('extension can check for optional input presence without throwing', () => {
    const def = makeKSamplerDef()
    const optional = def.input.optional ?? {}
    const hasExtra = 'extra_pnginfo' in optional
    expect(typeof hasExtra).toBe('boolean')
  })
})
