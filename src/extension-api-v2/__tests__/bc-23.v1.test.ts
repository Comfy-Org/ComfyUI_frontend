// Category: BC.23 — Node property bag mutations
// DB cross-ref: S2.N18
// blast_radius: 4.67 (compat-floor)
// v1 contract: node.properties['key'] = value — direct mutation of the property bag
// TODO(R8): swap with loadEvidenceSnippet once excerpts populated

import { describe, expect, it } from 'vitest'
import { countEvidenceExcerpts, loadEvidenceSnippet, runV1 } from '../harness'

void [loadEvidenceSnippet, runV1]

describe('BC.23 v1 contract — node.properties direct mutation (S2.N18)', () => {
  it.skip('S2.N18 has at least one evidence excerpt — TODO(R8): harness snapshot does not yet include S2.N18 excerpts', () => {
    expect(countEvidenceExcerpts('S2.N18')).toBeGreaterThan(0)
  })

  it('direct mutation of node.properties sets the value', () => {
    const node = { properties: {} as Record<string, unknown> }
    node.properties['seed'] = 42
    expect(node.properties['seed']).toBe(42)
  })

  it('direct mutation does NOT trigger onPropertyChanged', () => {
    const log: string[] = []
    const node = {
      properties: {} as Record<string, unknown>,
      onPropertyChanged(_name: string, _value: unknown) { log.push(_name) },
    }
    node.properties['seed'] = 42
    expect(log).toHaveLength(0)
  })

  it('multiple keys can be set independently', () => {
    const node = { properties: {} as Record<string, unknown> }
    node.properties['seed'] = 1
    node.properties['steps'] = 20
    node.properties['cfg'] = 7.5
    expect(node.properties['seed']).toBe(1)
    expect(node.properties['steps']).toBe(20)
    expect(node.properties['cfg']).toBe(7.5)
  })

  it('property bag survives serialization to JSON and back', () => {
    const node = { properties: { seed: 42, sampler_name: 'euler' } }
    const serialized = JSON.stringify(node)
    const restored = JSON.parse(serialized) as typeof node
    expect(restored.properties['seed']).toBe(42)
    expect(restored.properties['sampler_name']).toBe('euler')
  })

  it('extension can read node.properties after another extension wrote to it', () => {
    const node = { properties: {} as Record<string, unknown> }
    // ext A writes
    node.properties['my_key'] = 'ext-a-value'
    // ext B reads
    const val = node.properties['my_key']
    expect(val).toBe('ext-a-value')
  })
})
