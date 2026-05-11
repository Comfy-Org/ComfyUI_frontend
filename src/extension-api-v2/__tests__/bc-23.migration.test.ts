/**
 * BC.23 — Node property bag mutations [v1 → v2 migration]
 *
 * Pattern: S2.N18
 *
 * Migration table:
 *   v1: node.properties.myKey = value          (direct object mutation)
 *   v1: const v = node.properties.myKey        (direct object read)
 *   v1: node.onPropertyChanged = function(prop, value, prevValue) {}
 *   v2: node.setProperty(key, value)           (dispatches command)
 *   v2: node.getProperty<T>(key)               (typed read)
 *   v2: no on('propertyChange') in Phase A — use 'configured' or polling
 *
 * Phase A: synthetic fixtures assert behavioral parity (same read/write semantics).
 * Phase B: hydrate with loadEvidenceSnippet() once eval sandbox lands.
 *
 * DB cross-ref: S2.N18
 */
import { describe, it, expect } from 'vitest'

import { loadEvidenceSnippet, runV1, runV2 } from '@/extension-api-v2/harness'
import type { NodeHandle, NodeEntityId } from '@/types/extensionV2'

void [loadEvidenceSnippet, runV1, runV2]

// ─── Fixtures ────────────────────────────────────────────────────────────────

interface LegacyNode {
  properties: Record<string, unknown>
  onPropertyChanged?: (prop: string, value: unknown, prevValue: unknown) => void
}

function makeLegacyNode(initial: Record<string, unknown> = {}): LegacyNode {
  return { properties: { ...initial } }
}

function makeV2Node(
  legacy: LegacyNode
): NodeHandle & { _legacy: LegacyNode } {
  return {
    entityId: 1 as NodeEntityId,
    type: 'TestNode',
    comfyClass: 'TestNode',
    getPosition: () => [0, 0],
    getSize: () => [100, 100],
    getTitle: () => 'Test',
    getMode: () => 0,
    getProperty<T>(key: string) { return legacy.properties[key] as T | undefined },
    getProperties() { return { ...legacy.properties } },
    isSelected: () => false,
    setPosition: () => {},
    setSize: () => {},
    setTitle: () => {},
    setMode: () => {},
    setProperty(key: string, value: unknown) {
      const prev = legacy.properties[key]
      legacy.properties[key] = value
      legacy.onPropertyChanged?.(key, value, prev)
    },
    widget: () => undefined,
    widgets: () => [],
    addWidget: () => { throw new Error('not needed') },
    inputs: () => [],
    outputs: () => [],
    on: () => {},
    get _legacy() { return legacy },
  } as unknown as NodeHandle & { _legacy: LegacyNode }
}

// ─── S2.N18 migration tests ──────────────────────────────────────────────────

describe('BC.23 [migration] — S2.N18: property bag read', () => {
  it('v1 direct read and v2 getProperty return the same value', () => {
    const legacy = makeLegacyNode({ strength: 0.75 })
    const v2 = makeV2Node(legacy)

    // v1 pattern
    const v1Value = legacy.properties['strength']
    // v2 pattern
    const v2Value = v2.getProperty<number>('strength')

    expect(v1Value).toBe(v2Value)
  })

  it('v1 read of absent key gives undefined; v2 getProperty also undefined', () => {
    const legacy = makeLegacyNode()
    const v2 = makeV2Node(legacy)

    expect(legacy.properties['missing']).toBeUndefined()
    expect(v2.getProperty('missing')).toBeUndefined()
  })
})

describe('BC.23 [migration] — S2.N18: property bag write', () => {
  it('v1 direct assignment and v2 setProperty produce the same stored value', () => {
    // v1
    const v1Node = makeLegacyNode()
    v1Node.properties['seed'] = 99

    // v2 (backed by separate legacy object, same shape)
    const v2Node = makeV2Node(makeLegacyNode())
    v2Node.setProperty('seed', 99)

    expect(v1Node.properties['seed']).toBe(v2Node.getProperty<number>('seed'))
  })

  it('v2 setProperty invokes onPropertyChanged with key, new value, and prev value', () => {
    const legacy = makeLegacyNode({ scale: 1.0 })
    const v2 = makeV2Node(legacy)

    const calls: Array<{ prop: string; value: unknown; prev: unknown }> = []
    legacy.onPropertyChanged = (prop, value, prev) => calls.push({ prop, value, prev })

    v2.setProperty('scale', 2.0)

    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({ prop: 'scale', value: 2.0, prev: 1.0 })
  })

  it('v1 direct mutation does not notify onPropertyChanged (migration improvement)', () => {
    // Documents that v1 extensions had to call onPropertyChanged manually or not at all.
    // v2 setProperty guarantees the callback fires — no separate manual call needed.
    const legacy = makeLegacyNode({ level: 3 })
    const calls: unknown[] = []
    legacy.onPropertyChanged = () => calls.push(true)

    // v1 pattern: direct assignment — callback NOT automatically invoked
    legacy.properties['level'] = 5
    expect(calls).toHaveLength(0)

    // v2 pattern: setProperty fires it
    const v2 = makeV2Node(legacy)
    v2.setProperty('level', 7)
    expect(calls).toHaveLength(1)
  })
})

describe('BC.23 [migration] — S2.N18: getProperties snapshot', () => {
  it('v1 properties object and v2 getProperties() snapshot contain the same keys', () => {
    const initial = { a: 1, b: 'hello', c: true }
    const legacy = makeLegacyNode(initial)
    const v2 = makeV2Node(legacy)

    expect(v2.getProperties()).toEqual(legacy.properties)
  })
})
