import { describe, expect, it } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import { LLink } from '@/lib/litegraph/src/LLink'

describe('LLink hidden/label', () => {
  it('round-trips hidden and label through asSerialisable/create', () => {
    const link = new LLink(1, 'MODEL', 4, 0, 5, 0)
    link.hidden = true
    link.label = 'Checkpoint'

    const data = link.asSerialisable()
    expect(data.hidden).toBe(true)
    expect(data.label).toBe('Checkpoint')

    const restored = LLink.create(data)
    expect(restored.hidden).toBe(true)
    expect(restored.label).toBe('Checkpoint')
  })

  it('omits hidden and label from serialization when unset', () => {
    const data = new LLink(1, 'MODEL', 4, 0, 5, 0).asSerialisable()
    expect(data.hidden).toBeUndefined()
    expect(data.label).toBeUndefined()
  })

  it('copies hidden and label via configure', () => {
    const source = new LLink(1, 'MODEL', 4, 0, 5, 0)
    source.hidden = true
    source.label = 'Latent'

    const target = new LLink(2, 'INT', 0, 0, 0, 0)
    target.configure(source)

    expect(target.hidden).toBe(true)
    expect(target.label).toBe('Latent')
  })

  it('survives a graph serialize → configure round-trip (v0.4 linkExtensions)', () => {
    const graph = new LGraph()
    const link = new LLink(1, 'MODEL', 10, 0, 20, 0)
    link.hidden = true
    link.label = 'Backbone'
    graph._links.set(link.id, link)

    const data = graph.serialize()
    expect(data.extra?.linkExtensions).toContainEqual(
      expect.objectContaining({ id: 1, hidden: true, label: 'Backbone' })
    )

    const restored = new LGraph()
    restored.configure(data)
    const restoredLink = restored._links.get(1)
    expect(restoredLink?.hidden).toBe(true)
    expect(restoredLink?.label).toBe('Backbone')
  })

  it('omits linkExtensions when no link has hidden/label/parent', () => {
    const graph = new LGraph()
    graph._links.set(1, new LLink(1, 'MODEL', 10, 0, 20, 0))

    expect(graph.serialize().extra?.linkExtensions).toBeUndefined()
  })
})
