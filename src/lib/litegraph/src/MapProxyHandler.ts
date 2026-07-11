/**
 * Temporary workaround until downstream consumers migrate to Map.
 * A brittle wrapper with many flaws, but should be fine for simple maps using int indexes.
 */
export class MapProxyHandler<
  K extends number | string,
  V
> implements ProxyHandler<Map<K, V>> {
  constructor(private readonly toKey: (value: number | string) => K) {}

  private getKey(p: string): K {
    const int = parseInt(p, 10)
    return this.toKey(Number.isNaN(int) ? p : int)
  }

  getOwnPropertyDescriptor(
    target: Map<K, V>,
    p: string | symbol
  ): PropertyDescriptor | undefined {
    const value = this.get(target, p)
    if (value) {
      return {
        configurable: true,
        enumerable: true,
        value
      }
    }
  }

  has(target: Map<K, V>, p: string | symbol): boolean {
    if (typeof p === 'symbol') return false

    return target.has(this.getKey(p))
  }

  ownKeys(target: Map<K, V>): ArrayLike<string | symbol> {
    return [...target.keys()].map(String)
  }

  get(target: Map<K, V>, p: string | symbol): V | undefined {
    // Workaround does not support link IDs of "values", "entries", "constructor", etc.
    if (p in target) return Reflect.get(target, p, target)
    if (typeof p === 'symbol') return

    return target.get(this.getKey(p))
  }

  set(target: Map<K, V>, p: string | symbol, newValue: V): boolean {
    if (typeof p === 'symbol') return false

    target.set(this.getKey(p), newValue)
    return true
  }

  deleteProperty(target: Map<K, V>, p: string | symbol): boolean {
    if (typeof p === 'symbol') return false
    return target.delete(this.getKey(p))
  }

  static bindAllMethods(map: Map<unknown, unknown>): void {
    map.clear = map.clear.bind(map)
    map.delete = map.delete.bind(map)
    map.forEach = map.forEach.bind(map)
    map.get = map.get.bind(map)
    map.has = map.has.bind(map)
    map.set = map.set.bind(map)
    map.entries = map.entries.bind(map)
    map.keys = map.keys.bind(map)
    map.values = map.values.bind(map)

    map[Symbol.iterator] = map[Symbol.iterator].bind(map)
  }
}
