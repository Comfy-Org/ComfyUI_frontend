import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createHandleFactory, resetUnknownReadWarnings } from './closedProxy'
import { ComfyDeletedError, ComfyReadonlyError } from './errors'

/** Stands in for an internal entity. Nothing here may escape a handle. */
class SecretEntity {
  title = 'original'
  readonly type = 'TestNode'
  readonly internalSecret = { danger: 'must not escape' }
  removed = false
  constructor(readonly id: string) {}
  touch() {
    return `touched:${this.id}`
  }
}

describe('closed proxy handles', () => {
  let entities: Map<string, SecretEntity>
  let factory: ReturnType<typeof makeFactory>

  function makeFactory(store: Map<string, SecretEntity>) {
    return createHandleFactory<SecretEntity>(
      {
        kind: 'node',
        identityProps: ['id'],
        props: {
          id: { get: (t) => t.id },
          type: {
            get: (t) => t.type,
            readonlyHint: 'Type is identity; use graph.replaceNode().'
          },
          title: { get: (t) => t.title, set: (t, v) => (t.title = String(v)) }
        },
        methods: {
          touch: (t) => t.touch()
        }
      },
      (id) => store.get(id)
    )
  }

  beforeEach(() => {
    entities = new Map([['n1', new SecretEntity('n1')]])
    factory = makeFactory(entities)
  })

  const handle = () => factory.handleFor('n1') as Record<string, unknown>

  describe('surface is closed', () => {
    it('reads declared properties', () => {
      expect(handle().title).toBe('original')
      expect(handle().type).toBe('TestNode')
    })

    it('returns undefined for undeclared properties', () => {
      expect(handle().internalSecret).toBeUndefined()
      expect(handle().removed).toBeUndefined()
      expect(handle().anythingElse).toBeUndefined()
    })

    it('exposes no prototype and no constructor escape', () => {
      expect(Object.getPrototypeOf(handle())).toBeNull()
      expect(handle().constructor).toBeUndefined()
      expect(handle()['__proto__']).toBeUndefined()
    })

    it('blocks the Vue reactive-target escape hatch', () => {
      expect(handle()['__v_raw']).toBeUndefined()
      expect(handle()['__v_isRef']).toBeUndefined()
    })

    it('returns undefined for unknown symbol access', () => {
      expect((handle() as never)[Symbol.iterator as never]).toBeUndefined()
      expect(Object.prototype.toString.call(handle())).toBe(
        '[object ComfyNode]'
      )
    })

    it('enumerates only the declared surface', () => {
      expect(Object.keys(handle()).sort()).toEqual([
        'id',
        'isDeleted',
        'title',
        'type'
      ])
    })

    it('rejects structural tampering', () => {
      expect(() => Object.defineProperty(handle(), 'x', { value: 1 })).toThrow()
      expect(() => Object.setPrototypeOf(handle(), {})).toThrow()
      expect(() => {
        delete handle().title
      }).toThrow()
    })
  })

  describe('data extraction yields inert plain objects', () => {
    it('spreads to plain data without methods', () => {
      const spread = { ...handle() }
      expect(spread).toEqual({
        id: 'n1',
        type: 'TestNode',
        title: 'original',
        isDeleted: false
      })
      expect(typeof spread.touch).toBe('undefined')
    })

    it('produces a structured-cloneable snapshot', () => {
      // Proves nothing internal is attached: a live object would throw here.
      expect(() => structuredClone({ ...handle() })).not.toThrow()
    })

    it('serialises to JSON without leaking internals', () => {
      const json = JSON.parse(JSON.stringify(handle()))
      expect(json.internalSecret).toBeUndefined()
      expect(json.title).toBe('original')
    })

    it('serialises identity after deletion', () => {
      entities.delete('n1')

      expect(JSON.parse(JSON.stringify(handle()))).toEqual({
        id: 'n1',
        isDeleted: true
      })
    })

    it('has no property path reaching the real entity', () => {
      const real = entities.get('n1')
      const seen = new Set<unknown>()
      const walk = (value: unknown, depth: number): boolean => {
        if (depth > 4 || value === null || typeof value !== 'object') {
          return false
        }
        if (value === real) return true
        if (seen.has(value)) return false
        seen.add(value)
        return Object.values(value).some((v) => walk(v, depth + 1))
      }
      expect(walk(handle(), 0)).toBe(false)
    })
  })

  describe('mutation', () => {
    it('writes through declared setters', () => {
      handle().title = 'renamed'
      expect(entities.get('n1')!.title).toBe('renamed')
    })

    it('throws on read-only properties, with a migration hint', () => {
      expect(() => {
        handle().type = 'Other'
      }).toThrow(ComfyReadonlyError)
      expect(() => {
        handle().type = 'Other'
      }).toThrow(/graph\.replaceNode/)
    })

    it('throws on undeclared properties rather than silently accepting', () => {
      expect(() => {
        handle().somethingNew = 1
      }).toThrow(ComfyReadonlyError)
    })
  })

  describe('identity', () => {
    it('returns the same handle for the same id', () => {
      expect(factory.handleFor('n1')).toBe(factory.handleFor('n1'))
    })

    it('memoises bound methods so equality holds', () => {
      expect(handle().touch).toBe(handle().touch)
    })

    it('liveHandleFor returns undefined for a missing entity', () => {
      expect(factory.liveHandleFor('nope')).toBeUndefined()
      expect(factory.liveHandleFor('n1')).toBeDefined()
    })

    it('does not share a handle across graph scopes', () => {
      // Ids repeat across graphs. A handle records the scope it was made in, so
      // reusing the root's handle inside a subgraph left `adopt()` resolving
      // node 3 against the graph the user had left.
      let scope = 'root'
      const scoped = createHandleFactory<SecretEntity>(
        {
          kind: 'node',
          identityProps: ['id'],
          props: { id: { get: (t) => t.id } },
          methods: {}
        },
        (id) => entities.get(id),
        '',
        () => scope
      )

      // Read as a pack reads it, through the well-known symbol.
      const tokenOf = (handle: object) =>
        (handle as Record<symbol, { graphId?: string }>)[
          Symbol.for('comfy.handle')
        ]

      const inRoot = scoped.handleFor('n1')
      scope = 'subgraph'
      const inSubgraph = scoped.handleFor('n1')

      expect(inSubgraph).not.toBe(inRoot)
      expect(tokenOf(inRoot).graphId).toBe('root')
      expect(tokenOf(inSubgraph).graphId).toBe('subgraph')
    })
  })

  describe('when the entity is deleted', () => {
    let dead: Record<string, unknown>

    beforeEach(() => {
      dead = handle()
      entities.delete('n1')
    })

    it('reports isDeleted without throwing', () => {
      expect(dead.isDeleted).toBe(true)
    })

    it('keeps identity readable for logging and cleanup', () => {
      expect(dead.id).toBe('n1')
    })

    it('returns undefined for non-identity reads', () => {
      expect(dead.title).toBeUndefined()
      expect(dead.type).toBeUndefined()
    })

    it('throws a descriptive error on mutation', () => {
      expect(() => {
        dead.title = 'zombie'
      }).toThrow(ComfyDeletedError)
      expect(() => {
        dead.title = 'zombie'
      }).toThrow(/isDeleted/)
    })

    it('makes methods inert rather than fatal', () => {
      expect(() => (dead.touch as () => unknown)()).not.toThrow()
      expect((dead.touch as () => unknown)()).toBeUndefined()
    })

    it('still spreads and serialises safely', () => {
      expect(() => ({ ...dead })).not.toThrow()
      expect(JSON.parse(JSON.stringify(dead)).isDeleted).toBe(true)
    })

    it('revives cleanly if the id is reused', () => {
      entities.set('n1', new SecretEntity('n1'))
      expect(dead.isDeleted).toBe(false)
      expect(dead.title).toBe('original')
    })

    it('prunes dead handles from the cache', () => {
      factory.prune()
      entities.set('n1', new SecretEntity('n1'))
      expect(factory.handleFor('n1')).not.toBe(dead)
    })
  })

  describe('the handle cache is weak', () => {
    it('shares one handle while a reference is held', () => {
      const held = factory.handleFor('n1')
      expect(factory.handleFor('n1')).toBe(held)
      expect(factory.cacheSize).toBe(1)
    })

    it('reclaims slots for entities that are gone', () => {
      factory.handleFor('n1')
      entities.delete('n1')
      factory.prune()
      expect(factory.cacheSize).toBe(0)
    })

    it('does not retain slots for entities that are removed in bulk', () => {
      for (let i = 0; i < 50; i++) {
        entities.set(`bulk${i}`, new SecretEntity(`bulk${i}`))
        factory.handleFor(`bulk${i}`)
      }
      expect(factory.cacheSize).toBe(50)

      for (let i = 0; i < 50; i++) entities.delete(`bulk${i}`)
      factory.prune()
      expect(factory.cacheSize).toBe(0)
    })

    // Real collection needs --expose-gc; skipped otherwise rather than faked,
    // so a green run never implies GC behaviour that was not observed.
    // FinalizationRegistry callbacks are not prompt, so this polls rather than
    // assuming a single cycle suffices.
    const gc = (globalThis as { gc?: () => void }).gc
    it.skipIf(!gc)('drops cache slots once handles are collected', async () => {
      for (let i = 0; i < 100; i++) {
        entities.set(`tmp${i}`, new SecretEntity(`tmp${i}`))
        factory.handleFor(`tmp${i}`)
      }
      expect(factory.cacheSize).toBe(100)

      for (
        let attempt = 0;
        attempt < 20 && factory.cacheSize === 100;
        attempt++
      ) {
        gc!()
        await new Promise((r) => setTimeout(r, 10))
      }

      // Handles are unreferenced, so the weak cache must shed at least some
      // slots. Exact counts are not guaranteed by the spec.
      expect(factory.cacheSize).toBeLessThan(100)
    })
  })
})

describe('reading a member that does not exist', () => {
  function handleForTest() {
    const store = new Map([['1', new SecretEntity('1')]])
    return createHandleFactory<SecretEntity>(
      { kind: 'node', props: { id: { get: (t) => t.id } } },
      (id) => store.get(id)
    ).handleFor('1')
  }

  beforeEach(resetUnknownReadWarnings)

  it('reads as undefined and says so once', () => {
    // A conversion kept `node.graph.isRootGraph` long after handles stopped
    // having a `graph`, and the branch simply never ran.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const handle = handleForTest()

    expect((handle as Record<string, unknown>)['graph']).toBeUndefined()
    expect((handle as Record<string, unknown>)['graph']).toBeUndefined()

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain("'graph' is not a member")
  })

  it('stays quiet for keys the language probes', () => {
    // Warning here would fire on `await handle`, JSON.stringify, or a spread.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warn.mockClear()
    const handle = handleForTest() as Record<string, unknown>

    void handle['then']
    void handle['toJSON']
    // Vue probes these on anything it makes reactive.
    void handle['__v_isRef']
    void handle['__v_raw']

    expect(warn).not.toHaveBeenCalled()
  })
})
