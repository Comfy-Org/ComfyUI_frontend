import type { LGraphNode } from './LGraphNode'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Default properties to track.
 *
 * All entries are {@link LGraphNode} accessors backed by the node's `_state`
 * (the node-data store proxy); instrumentation wraps each accessor to emit
 * `node:property:changed` without shadowing the `_state` write. `shape` is
 * omitted because its own accessor already emits; `flags.*` are omitted because
 * the reactive `_state.flags` covers renderer reactivity and nothing consumes
 * their change event.
 */
const DEFAULT_TRACKED_PROPERTIES: string[] = [
  'title',
  'mode',
  'color',
  'bgcolor',
  'showAdvanced'
]
/**
 * Manages node properties with optional change tracking and instrumentation.
 */
export class LGraphNodeProperties {
  /** The node this property manager belongs to */
  node: LGraphNode

  /** Set of property paths that have been instrumented */
  private _instrumentedPaths = new Set<string>()

  constructor(node: LGraphNode) {
    this.node = node

    this._setupInstrumentation()
  }

  /**
   * Sets up property instrumentation for all tracked properties
   */
  private _setupInstrumentation(): void {
    for (const path of DEFAULT_TRACKED_PROPERTIES) {
      this._instrumentProperty(path)
    }
  }

  private _resolveTargetObject(parts: string[]): {
    targetObject: Record<string, unknown>
    propertyName: string
  } {
    // LGraphNode supports dynamic property access at runtime
    let targetObject: Record<string, unknown> = this.node as unknown as Record<
      string,
      unknown
    >

    if (parts.length === 1) {
      return { targetObject, propertyName: parts[0] }
    }

    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i]
      const next = targetObject[key]
      if (isRecord(next)) {
        targetObject = next
      }
    }

    return {
      targetObject,
      propertyName: parts[parts.length - 1]
    }
  }

  /**
   * Instruments a single property to track changes
   */
  private _instrumentProperty(path: string): void {
    const parts = path.split('.')

    if (parts.length > 1) {
      this._ensureNestedPath(path)
    }

    const { targetObject, propertyName } = this._resolveTargetObject(parts)

    const accessor = this._findAccessorDescriptor(targetObject, propertyName)
    if (accessor?.get && accessor.set) {
      this._instrumentAccessor(
        path,
        targetObject,
        propertyName,
        accessor.get,
        accessor.set
      )
      this._instrumentedPaths.add(path)
      return
    }

    const hasProperty = Object.prototype.hasOwnProperty.call(
      targetObject,
      propertyName
    )
    const currentValue = targetObject[propertyName]

    if (!hasProperty) {
      let value: unknown = undefined

      Object.defineProperty(targetObject, propertyName, {
        get: () => value,
        set: (newValue: unknown) => {
          const oldValue = value
          value = newValue
          this._emitPropertyChange(path, oldValue, newValue)

          // Update enumerable: true for non-undefined values, false for undefined
          const shouldBeEnumerable = newValue !== undefined
          const currentDescriptor = Object.getOwnPropertyDescriptor(
            targetObject,
            propertyName
          )
          if (
            currentDescriptor &&
            currentDescriptor.enumerable !== shouldBeEnumerable
          ) {
            Object.defineProperty(targetObject, propertyName, {
              ...currentDescriptor,
              enumerable: shouldBeEnumerable
            })
          }
        },
        enumerable: false,
        configurable: true
      })
    } else {
      Object.defineProperty(
        targetObject,
        propertyName,
        this._createInstrumentedDescriptor(path, currentValue)
      )
    }

    this._instrumentedPaths.add(path)
  }

  /** Finds a property's descriptor, walking the prototype chain. */
  private _findAccessorDescriptor(
    obj: object,
    propertyName: string
  ): PropertyDescriptor | undefined {
    let current: object | null = obj
    while (current) {
      const descriptor = Object.getOwnPropertyDescriptor(current, propertyName)
      if (descriptor) return descriptor
      current = Object.getPrototypeOf(current)
    }
    return undefined
  }

  /**
   * Wraps an existing accessor with an own property that delegates get/set to
   * it and emits on change, so the value keeps living behind the accessor (the
   * node's `_state`) instead of a shadowing closure.
   */
  private _instrumentAccessor(
    path: string,
    targetObject: Record<string, unknown>,
    propertyName: string,
    get: () => unknown,
    set: (value: unknown) => void
  ): void {
    Object.defineProperty(targetObject, propertyName, {
      get: () => get.call(targetObject),
      set: (newValue: unknown) => {
        const oldValue = get.call(targetObject)
        set.call(targetObject, newValue)
        this._emitPropertyChange(path, oldValue, newValue)
      },
      enumerable: true,
      configurable: true
    })
  }

  /**
   * Creates a property descriptor that emits change events
   */
  private _createInstrumentedDescriptor(
    propertyPath: string,
    initialValue: unknown
  ): PropertyDescriptor {
    return this._createInstrumentedDescriptorTyped(propertyPath, initialValue)
  }

  private _createInstrumentedDescriptorTyped<TValue>(
    propertyPath: string,
    initialValue: TValue
  ): PropertyDescriptor {
    let value: TValue = initialValue

    return {
      get: () => value,
      set: (newValue: TValue) => {
        const oldValue = value
        value = newValue
        this._emitPropertyChange(propertyPath, oldValue, newValue)
      },
      enumerable: true,
      configurable: true
    }
  }

  /**
   * Emits a property change event if the node is connected to a graph
   */
  private _emitPropertyChange(
    propertyPath: string,
    oldValue: unknown,
    newValue: unknown
  ): void {
    this._emitPropertyChangeTyped(propertyPath, oldValue, newValue)
  }

  private _emitPropertyChangeTyped<TValue>(
    propertyPath: string,
    oldValue: TValue,
    newValue: TValue
  ): void {
    this.node.graph?.trigger('node:property:changed', {
      nodeId: this.node.id,
      property: propertyPath,
      oldValue,
      newValue
    })
  }

  /**
   * Ensures parent objects exist for nested properties
   */
  private _ensureNestedPath(path: string): void {
    const parts = path.split('.')
    // LGraphNode supports dynamic property access at runtime
    let current: Record<string, unknown> = this.node as unknown as Record<
      string,
      unknown
    >

    // Create all parent objects except the last property
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!current[part]) {
        current[part] = {}
      }
      const next = current[part]
      if (isRecord(next)) {
        current = next
      }
    }
  }

  /**
   * Checks if a property is being tracked
   */
  isTracked(path: string): boolean {
    return this._instrumentedPaths.has(path)
  }

  /**
   * Gets the list of tracked properties
   */
  getTrackedProperties(): string[] {
    return [...DEFAULT_TRACKED_PROPERTIES]
  }

  /**
   * Custom toJSON method for JSON.stringify
   * Returns undefined to exclude from serialization since we only use defaults
   */
  toJSON(): undefined {
    return undefined
  }
}
