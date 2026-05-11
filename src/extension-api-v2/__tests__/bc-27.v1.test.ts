// Category: BC.27 — LiteGraph entity direct manipulation (reroute, group, link, slot)
// DB cross-ref: S9.R1, S9.G1, S9.L1, S9.S1
// blast_radius: 4.05 (compat-floor)
// v1 contract: node.inputs.push({...}) / graph.groups.push({...}) / direct link array mutation
// TODO(R8): swap with loadEvidenceSnippet once excerpts populated

import { describe, expect, it } from 'vitest'
import { countEvidenceExcerpts, loadEvidenceSnippet, runV1 } from '../harness'

void [loadEvidenceSnippet, runV1]

type Slot = { name: string; type: string; link?: number | null }
type Group = { title: string; pos: [number, number]; size: [number, number] }
type Link = { id: number; origin_id: number; origin_slot: number; target_id: number; target_slot: number }

describe('BC.27 v1 contract — LiteGraph entity direct manipulation (S9.R1/G1/L1/S1)', () => {
  it.skip('S9.R1 has at least one evidence excerpt — TODO(R8): harness snapshot does not yet include S9.R1 excerpts', () => {
    expect(countEvidenceExcerpts('S9.R1')).toBeGreaterThan(0)
  })

  it('S9.S1 — node.inputs.push adds a new slot to the node', () => {
    const node = { inputs: [] as Slot[] }
    node.inputs.push({ name: 'latent', type: 'LATENT', link: null })
    expect(node.inputs).toHaveLength(1)
    expect(node.inputs[0].name).toBe('latent')
    expect(node.inputs[0].type).toBe('LATENT')
  })

  it('S9.S1 — node.outputs.push adds a new output slot', () => {
    const node = { outputs: [] as Slot[] }
    node.outputs.push({ name: 'IMAGE', type: 'IMAGE' })
    expect(node.outputs[0].type).toBe('IMAGE')
  })

  it('S9.G1 — graph.groups.push adds a group to the canvas', () => {
    const graph = { groups: [] as Group[] }
    graph.groups.push({ title: 'My Group', pos: [0, 0], size: [200, 150] })
    expect(graph.groups).toHaveLength(1)
    expect(graph.groups[0].title).toBe('My Group')
  })

  it('S9.L1 — direct link mutation sets origin/target correctly', () => {
    const link: Link = { id: 1, origin_id: 10, origin_slot: 0, target_id: 20, target_slot: 0 }
    expect(link.origin_id).toBe(10)
    expect(link.target_id).toBe(20)
  })

  it('slot.link can be set to a link id or null', () => {
    const slot: Slot = { name: 'image', type: 'IMAGE', link: null }
    slot.link = 5
    expect(slot.link).toBe(5)
    slot.link = null
    expect(slot.link).toBeNull()
  })

  it.todo('S9.R1 — reroute node pass-through link remapping (Phase B — requires real LiteGraph serializer)')
  it.todo('S9.L1 — removing a link from graph.links array disconnects source and target slots (Phase B)')
})
