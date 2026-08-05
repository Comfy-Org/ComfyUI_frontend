/**
 * Closed proxy handles for the public custom-node API.
 *
 * A handle stores an **id**, never a reference. Every access re-resolves the
 * entity, which gives three properties the previous API could not:
 *
 * 1. No internal object is reachable. Property access outside the declared
 *    surface returns `undefined`; there is no prototype, no `constructor`, and
 *    no `__v_raw` escape to the Vue reactive target.
 * 2. Handles outlive their entities safely. A pack that stores a handle and
 *    reads it after the node is deleted gets `isDeleted === true` and inert
 *    reads, not a stale object that still looks alive.
 * 3. Identity is stable. `graph.node(id) === graph.node(id)`, so the equality
 *    checks packs already write keep working.
 */
import { ComfyDeletedError, ComfyReadonlyError } from './errors'

export interface PropSpec<TTarget> {
  get(target: TTarget): unknown
  set?(target: TTarget, value: unknown): void
  /** Appended to the error when a pack assigns to a read-only property. */
  readonlyHint?: string
}

export interface HandleSpec<TTarget> {
  /** Used in errors and `Symbol.toStringTag`, e.g. 'node'. */
  readonly kind: string
  readonly props: Readonly<Record<string, PropSpec<TTarget>>>
  readonly methods?: Readonly<
    Record<string, (target: TTarget, ...args: never[]) => unknown>
  >
  /**
   * Props that remain readable after deletion. Identity only — an id or type is
   * still useful for logging and cleanup once the entity is gone.
   */
  readonly identityProps?: readonly string[]
}

/** Present on every handle. Never throws, even when the entity is gone. */
export interface HandleCommon {
  readonly isDeleted: boolean
}

const RESERVED = 'isDeleted'

/**
 * Cross-major identity token.
 *
 * Handles from different API majors are necessarily different objects — one
 * object cannot have two shapes — so `===` fails across majors even for the
 * same entity. Packs do pass handles to each other through hooks, so identity
 * has to survive that.
 *
 * Every handle therefore carries `{ kind, id }` under a registry symbol. Any
 * major can read it, it exposes nothing internal, and being a symbol it stays
 * out of `Object.keys`, spreads and JSON.
 */
export const COMFY_HANDLE = Symbol.for('comfy.handle')

export interface HandleToken {
  readonly kind: string
  readonly id: string
}

/** Reads the identity token from a possible handle of any major. */
export function handleToken(value: unknown): HandleToken | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const token = (value as Record<symbol, unknown>)[COMFY_HANDLE]
  return typeof token === 'object' && token !== null
    ? (token as HandleToken)
    : undefined
}

/** True when two handles refer to the same entity, whatever their major. */
export function isSameEntity(a: unknown, b: unknown): boolean {
  const ta = handleToken(a)
  const tb = handleToken(b)
  return !!ta && !!tb && ta.kind === tb.kind && ta.id === tb.id
}

/**
 * Creates a factory that mints stable, closed handles for one entity kind.
 *
 * `resolve` is the only bridge to internals and is captured in a closure, so it
 * is unreachable from the returned handles.
 */
export function createHandleFactory<TTarget>(
  spec: HandleSpec<TTarget>,
  resolve: (id: string) => TTarget | undefined,
  /**
   * Cache namespace, normally the API major.
   *
   * Handles of different majors have different shapes, so a cache shared
   * across majors would hand back a correctly-identified but wrong-shaped
   * handle — a confusing failure. Keying on it makes the segregation explicit
   * rather than relying on each major happening to build its own factory.
   */
  namespace = ''
) {
  // Null-prototype lookup maps. A plain object literal inherits from
  // Object.prototype, so `'constructor' in spec.props` would be true and would
  // expose Object.prototype members as if they were declared API. Own-property
  // checks against a null-prototype map close that hole permanently.
  const props: Record<string, PropSpec<TTarget>> = Object.assign(
    Object.create(null),
    spec.props
  )
  const methods: Record<string, (t: TTarget, ...a: never[]) => unknown> =
    Object.assign(Object.create(null), spec.methods ?? {})

  const propKeys = Object.keys(props)
  const methodKeys = Object.keys(methods)
  const identity = new Set(spec.identityProps ?? [])
  const ownKeys = [...propKeys, ...methodKeys, RESERVED]
  const tag = `Comfy${spec.kind[0].toUpperCase()}${spec.kind.slice(1)}`

  // Weak cache: handles are shared while a pack still references one, and are
  // collected once nothing does. A strong Map here would pin a handle for every
  // node ever touched, for the lifetime of the session.
  const cache = new Map<string, WeakRef<object>>()
  const cacheKey = (id: string) => `${namespace}\u0000${id}`

  // Clears the map slot once the proxy itself is collected. Guarded, because a
  // newer handle may already occupy the slot by the time this fires.
  const finalizer = new FinalizationRegistry<string>((key) => {
    if (cache.get(key)?.deref() === undefined) cache.delete(key)
  })

  function create(id: string): object {
    // Bound methods are memoised so `h.foo === h.foo` holds.
    const bound = new Map<string, unknown>()
    const token: HandleToken = Object.freeze({ kind: spec.kind, id })

    const readable = (key: string, target: TTarget | undefined): unknown => {
      if (target === undefined) return undefined
      return props[key].get(target)
    }

    const handler: ProxyHandler<object> = {
      get(_t, key) {
        if (key === RESERVED) return resolve(id) === undefined
        if (typeof key === 'symbol') {
          if (key === COMFY_HANDLE) return token
          return key === Symbol.toStringTag ? tag : undefined
        }
        if (key === 'toJSON') {
          return () => {
            const target = resolve(id)
            const out: Record<string, unknown> = {}
            for (const k of propKeys) {
              if (target !== undefined || identity.has(k)) {
                out[k] = readable(k, target)
              }
            }
            out[RESERVED] = target === undefined
            return out
          }
        }
        if (Object.hasOwn(methods, key)) {
          if (!bound.has(key)) {
            bound.set(key, (...args: never[]) => {
              const target = resolve(id)
              // Methods on a dead handle are inert rather than fatal: packs
              // routinely call cleanup paths after removal.
              if (target === undefined) return undefined
              return methods[key](target, ...args)
            })
          }
          return bound.get(key)
        }
        if (Object.hasOwn(props, key)) {
          const target = resolve(id)
          if (target === undefined && !identity.has(key)) return undefined
          // Identity props stay readable when dead — resolved from the id.
          if (target === undefined) return identityFallback(key, id)
          return props[key].get(target)
        }
        return undefined
      },

      set(_t, key, value) {
        if (typeof key === 'symbol' || !Object.hasOwn(props, key)) {
          throw new ComfyReadonlyError(spec.kind, String(key))
        }
        const prop = props[key]
        if (!prop.set) {
          throw new ComfyReadonlyError(spec.kind, key, prop.readonlyHint)
        }
        const target = resolve(id)
        if (target === undefined) {
          throw new ComfyDeletedError(spec.kind, id, key)
        }
        prop.set(target, value)
        return true
      },

      has: (_t, key) => typeof key === 'string' && ownKeys.includes(key),
      ownKeys: () => [...ownKeys],

      getOwnPropertyDescriptor(_t, key) {
        if (typeof key !== 'string' || !ownKeys.includes(key)) return undefined
        // Only data props are enumerable, so `{...handle}` yields plain data
        // and skips methods.
        const isData = key === RESERVED || Object.hasOwn(props, key)
        return {
          configurable: true,
          enumerable: isData,
          writable: key !== RESERVED && !!props[key]?.set,
          value: handler.get!(_t, key, _t)
        }
      },

      getPrototypeOf: () => null,
      setPrototypeOf: () => false,
      defineProperty: () => false,
      deleteProperty: () => false,
      preventExtensions: () => false
    }

    return new Proxy(Object.create(null) as object, handler)
  }

  return {
    /**
     * A handle for `id`, whether or not the entity currently exists. Use when
     * an id is known to have been valid — the handle reports `isDeleted`.
     */
    handleFor(id: string): object {
      const key = cacheKey(id)
      const existing = cache.get(key)?.deref()
      if (existing) return existing

      const handle = create(id)
      cache.set(key, new WeakRef(handle))
      finalizer.register(handle, key)
      return handle
    },

    /** A handle only if the entity exists right now, else `undefined`. */
    liveHandleFor(id: string): object | undefined {
      return resolve(id) === undefined ? undefined : this.handleFor(id)
    },

    /**
     * Drops cache slots for entities that no longer exist, and slots whose
     * handle has already been collected.
     *
     * Not required for correctness — the weak cache and finalizer handle that —
     * but lets a caller reclaim map slots eagerly, e.g. after clearing a graph.
     */
    prune(): void {
      for (const [key, ref] of [...cache.entries()]) {
        const id = key.slice(key.indexOf('\u0000') + 1)
        if (ref.deref() === undefined || resolve(id) === undefined) {
          cache.delete(key)
        }
      }
    },

    /** Live cache slots. Diagnostics and tests only. */
    get cacheSize(): number {
      return cache.size
    }
  }
}

/**
 * Identity props are readable after deletion. Only `id` can be recovered
 * without the entity; anything else reports `undefined`.
 */
function identityFallback(key: string, id: string): unknown {
  return key === 'id' ? id : undefined
}
