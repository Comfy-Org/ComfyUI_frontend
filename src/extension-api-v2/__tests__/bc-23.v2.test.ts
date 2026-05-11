/**
 * BC.23 — Node property bag mutations [v2 contract]
 *
 * Pattern: S2.N18 — getProperty / setProperty on the persistent node property bag.
 *
 * V2 contract: extensions access the property bag exclusively via
 *   node.getProperty<T>(key)        — typed read, returns T | undefined
 *   node.getProperties()            — full snapshot Record<string, unknown>
 *   node.setProperty(key, value)    — dispatches a command (undo-able, serializable)
 *
 * Note: there is no on('propertyChange') overload on NodeHandle in Phase A.
 * Extensions that need reactive property change notification should subscribe to
 * the 'configured' event (fired after workflow load) and compare snapshots, or
 * await Phase B where a propertyChanged event will be added to NodeHandle.
 *
 * Phase A: tests assert the typed interface shape via synthetic NodeHandle fixtures.
 * Phase B upgrade: replace with loadEvidenceSnippet() + eval sandbox once it lands.
 *
 * DB cross-ref: S2.N18
 */
import { describe, it, expect } from 'vitest'

import { loadEvidenceSnippet, runV1, runV2 } from '@/extension-api-v2/harness'
import type { NodeHandle, NodeEntityId } from '@/types/extensionV2'

void [loadEvidenceSnippet, runV1, runV2]

// ─── Synthetic NodeHandle fixture ────────────────────────────────────────────

function makeNodeHandle(
  initialProperties: Record<string, unknown> = {}
): NodeHandle & { _props: Record<string, unknown> } {
  const props: Record<string, unknown> = { ...initialProperties }
  return {
    entityId: 1 as NodeEntityId,
    type: 'TestNode',
    comfyClass: 'TestNode',
    getPosition: () => [0, 0],
    getSize: () => [100, 100],
    getTitle: () => 'Test',
    getMode: () => 0,
    getProperty<T>(key: string) { return props[key] as T | undefined },
    getProperties() { return { ...props } },
    isSelected: () => false,
    setPosition: () => {},
    setSize: () => {},
    setTitle: () => {},
    setMode: () => {},
    setProperty(key: string, value: unknown) { props[key] = value },
    widget: () => undefined,
    widgets: () => [],
    addWidget: () => { throw new Error('not needed') },
    inputs: () => [],
    outputs: () => [],
    on: () => {},
    // Test-only
    get _props() { return props },
  } as unknown as NodeHandle & { _props: Record<string, unknown> }
}

// ─── S2.N18 — getProperty / setProperty round-trip ───────────────────────────

describe('BC.23 — Node property bag mutations [v2 contract]', () => {
  it('getProperty returns undefined for absent key', () => {
    const node = makeNodeHandle()
    expect(node.getProperty('nonexistent')).toBeUndefined()
  })

  it('setProperty stores and getProperty retrieves the value', () => {
    const node = makeNodeHandle()
    node.setProperty('seed', 42)
    expect(node.getProperty<number>('seed')).toBe(42)
  })

  it('setProperty overwrites an existing key', () => {
    const node = makeNodeHandle({ strength: 0.5 })
    node.setProperty('strength', 0.8)
    expect(node.getProperty<number>('strength')).toBe(0.8)
  })

  it('getProperties returns all keys as a snapshot', () => {
    const node = makeNodeHandle({ a: 1, b: 'hello' })
    const snap = node.getProperties()
    expect(snap).toEqual({ a: 1, b: 'hello' })
  })

  it('getProperties snapshot is independent of further mutations', () => {
    const node = makeNodeHandle({ x: 10 })
    const snap = node.getProperties()
    node.setProperty('x', 99)
    // snapshot taken before setProperty must not reflect the new value
    expect(snap.x).toBe(10)
    expect(node.getProperty<number>('x')).toBe(99)
  })

  it('property bag survives multiple set/get cycles', () => {
    const node = makeNodeHandle()
    const keys = ['alpha', 'beta', 'gamma']
    keys.forEach((k, i) => node.setProperty(k, i))
    keys.forEach((k, i) => expect(node.getProperty<number>(k)).toBe(i))
  })

  it('getProperty<T> typing — can round-trip complex objects', () => {
    const node = makeNodeHandle()
    const payload = { list: [1, 2, 3], nested: { flag: true } }
    node.setProperty('config', payload)
    const retrieved = node.getProperty<typeof payload>('config')
    expect(retrieved).toEqual(payload)
  })
})
